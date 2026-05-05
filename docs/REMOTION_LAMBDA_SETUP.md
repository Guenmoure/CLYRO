# Remotion Lambda Setup — CLYRO

This guide walks you through enabling AWS Lambda rendering for Motion + Motion Design videos.

**Why bother?** Local Chromium rendering on the `clyro-worker` Render service takes 3–5 min per Motion video and serializes one video at a time (concurrency = 1 to avoid OOM). Lambda parallelizes each video across multiple cloud functions, dropping wall-time to ~30–60 s and removing the worker bottleneck. Cost is ~$0.005–0.01 per video.

The pipeline is already wired to use Lambda automatically when `USE_REMOTION_LAMBDA=true` and the AWS credentials are present. If anything is missing, it falls back to local Chromium silently. So this setup is **opt-in** and reversible — flip a single env var to disable.

---

## TL;DR (the lazy path)

```bash
# 1. Set your AWS credentials in your shell
export AWS_REGION=eu-central-1
export AWS_ACCESS_KEY_ID=AKIA…
export AWS_SECRET_ACCESS_KEY=…

# 2. From the repo root, run the setup script (does steps 3-6 below)
./scripts/setup-lambda.sh

# 3. Copy the printed env vars to Render's clyro-worker service, then
#    flip USE_REMOTION_LAMBDA to 'true' on that same service.
```

If the script worked, skip to **Step 7 — Verify in production** below. If anything fails, read the rest.

---

## Prerequisites

1. **AWS account** with billing enabled (Lambda is in the free tier for the first 1M invocations/month, but the setup creates an S3 bucket which has a $0.023/GB/month storage fee).
2. **AWS CLI** installed locally and configured with credentials that have permission to deploy Lambda + create S3 buckets. Test with `aws sts get-caller-identity`.
3. **Node 20+** locally (same version as the worker). Test with `node -v`.
4. **Repo dependencies installed**. From repo root: `npm install`.

---

## Step 1 — Create a dedicated IAM user (recommended)

Don't use your AWS root credentials. Create a user with the minimum permissions Remotion needs.

1. AWS Console → **IAM** → **Users** → **Create user** → name it `remotion-lambda-clyro`.
2. **Attach policies directly** → search for and add these 4 AWS-managed policies:
   - `AWSLambda_FullAccess`
   - `AmazonS3FullAccess` — or scoped to `remotionlambda-*` buckets only
   - `IAMFullAccess` — Remotion needs to create its own IAM role for the Lambda function
   - `CloudWatchLogsFullAccess` — for render logs
3. After creation, click the user → **Security credentials** → **Create access key** → choose "Command Line Interface (CLI)" → copy the access key ID + secret.
4. Configure your local AWS CLI: `aws configure`
   - Access Key ID: paste from step 3
   - Secret Access Key: paste from step 3
   - Default region: `eu-central-1`
   - Output format: `json`

Verify: `aws sts get-caller-identity` should print your IAM user's ARN.

---

## Step 2 — Validate Remotion's IAM policies

Remotion has its own policy validator that checks your credentials can do everything it needs:

```bash
cd apps/api
npx remotion lambda policies validate
```

If this fails, the error message tells you exactly which permission is missing. Add it to your IAM user and retry.

---

## Step 3 — Deploy the Lambda function

This creates the actual Lambda function in your AWS account. You only do this once per region (or whenever you upgrade Remotion versions).

```bash
cd apps/api
npx remotion lambda functions deploy \
  --memory=3009 \
  --timeout=240 \
  --disk=2048 \
  --region=eu-central-1
```

What this does: deploys a Lambda function with 3 GB of RAM, 240 s max execution time, 2 GB ephemeral disk. The function name is auto-generated and includes the Remotion version + memory + disk + timeout (e.g. `remotion-render-4-0-448-mem3009mb-disk2048mb-240sec`).

**Save the function name** that gets printed — you'll need it for the env var `REMOTION_LAMBDA_FUNCTION_NAME`.

---

## Step 4 — Deploy the Remotion site (your bundle)

This uploads your React composition bundle (the `apps/api/src/remotion/Root.tsx` tree + everything in `packages/video/src/`) to an S3 bucket. Lambda functions fetch the bundle from S3 at render time.

```bash
cd apps/api
npx remotion lambda sites create src/remotion/Root.tsx \
  --site-name=clyro-motion \
  --region=eu-central-1
```

This prints a "Serve URL" like:
```
https://remotionlambda-eucentral1-abcd1234.s3.eu-central-1.amazonaws.com/sites/clyro-motion/index.html
```

**Save this URL** — you'll need it for `REMOTION_LAMBDA_SERVE_URL`.

> ⚠️ **Important:** every time you change anything in `packages/video/src/` (the React components), you MUST re-run this command. Otherwise Lambda renders the old bundle while local renders the new one. Add it to your CI/CD or to the commit message of every PR that touches `packages/video/`.

---

## Step 5 — Set the env vars on Render

Go to Render Dashboard → `clyro-worker` service → **Environment** tab → add these 6 variables:

| Variable | Value |
|---|---|
| `USE_REMOTION_LAMBDA` | `true` |
| `AWS_REGION` | `eu-central-1` |
| `AWS_ACCESS_KEY_ID` | `AKIA…` (from Step 1) |
| `AWS_SECRET_ACCESS_KEY` | `…` (from Step 1) |
| `REMOTION_LAMBDA_FUNCTION_NAME` | `remotion-render-4-0-448-…` (from Step 3) |
| `REMOTION_LAMBDA_SERVE_URL` | `https://remotionlambda-…/index.html` (from Step 4) |

Click **Save Changes**. Render will redeploy the worker with the new env vars (~2 min).

> The `clyro-api` service does NOT need these vars — only the worker does the rendering.

---

## Step 6 — Smoke test locally (optional but recommended)

Before testing in production, render a video locally with the Lambda renderer to confirm everything works:

```bash
# In your local .env, set the same 6 variables you just set on Render.
# Then start the worker locally:
cd apps/api
npm run worker  # or: node dist/workers/renderWorker.js
```

Trigger a Motion Design video from your local frontend. In the worker logs you should see:

```
MotionDesign: using Lambda renderer
Remotion Lambda (MotionDesign): starting render
Lambda render progress 10
Lambda render progress 20
…
Remotion Lambda (MotionDesign): render complete
```

If you see `MotionDesign: using local renderer` instead, check that all 6 env vars are set correctly (the `isLambdaEnabled()` function bails to local on the first missing var).

---

## Step 7 — Verify in production

After Render redeploys the worker:

1. Trigger a Motion Design video from your prod frontend.
2. Tail the `clyro-worker` logs on Render.
3. You should see the same Lambda lines as in Step 6.
4. Open the AWS Console → Lambda → your function → **Monitor** tab. You'll see invocations spike during the render.

**Wall time**: a 30 s Motion Design video should now render in ~30–60 s instead of ~3–5 min.

---

## Cost estimation

| Item | Cost |
|---|---|
| Lambda invocation (1 render = 1 invocation by default) | $0.0000002 |
| Lambda compute (3 GB × ~60 s) | $0.003 |
| S3 storage (output MP4 ~5 MB) | $0.0001/month |
| S3 PUT request | $0.0000005 |
| **Total per video** | **~$0.005** |

For 1000 videos/month: ~$5 of AWS cost. Compare to one extra `clyro-worker` instance on Render at $25/month and you're saving 5× while gaining horizontal scale.

---

## Disabling Lambda

To go back to local Chromium rendering, just set `USE_REMOTION_LAMBDA=false` (or remove the variable) on the `clyro-worker` service. The pipeline detects the change at render time — no code change required, no redeploy needed beyond Render's env-var hot-reload.

---

## Troubleshooting

### `policies validate` fails with "User is not authorized to perform: lambda:GetFunction"
Your IAM user is missing `AWSLambda_FullAccess`. Re-attach it (Step 1.2).

### `functions deploy` succeeds but `sites create` fails with "Bucket already exists"
Remotion creates a bucket the first time you deploy a site. If you ran it before with a different region, the bucket exists in another region. Either delete the old bucket or use a different `--site-name`.

### Lambda render hangs at "0%"
Check that `REMOTION_LAMBDA_SERVE_URL` is reachable from a browser (just paste it). If you get an S3 access denied, the bucket is private — re-run `sites create` (it sets the right bucket policy).

### Lambda render fails with "input image fetch timeout"
Your fal.ai image URLs are slow or expired. The pipeline already inlines images as data URLs before sending to Lambda (`inlineSceneImages()` in `remotionLambda.ts`), so this shouldn't happen. If it does, check that the worker has outbound network access to fal.ai's CDN.

### Lambda renders are visually different from local
You forgot to re-run `npx remotion lambda sites create` after changing a component in `packages/video/src/`. The Lambda is rendering the old bundle. Re-deploy the site (Step 4) and the next render will match local.

### Lambda concurrency limited to 10
New AWS accounts have a default Lambda concurrency limit of 10. To go higher, request a quota increase via AWS Service Quotas → Lambda → "Concurrent executions". Once raised, edit `framesPerLambda` in `apps/api/src/services/remotionLambda.ts` to a smaller value (e.g. `100`) so each render fans out across more Lambdas.

### Want to upgrade Remotion?
1. Update all `@remotion/*` packages in `apps/api/package.json` to the new version.
2. Re-run **Step 3** (deploys a new Lambda function with the new version) and **Step 4** (re-uploads the site bundle).
3. Update `REMOTION_LAMBDA_FUNCTION_NAME` on Render with the new function name.
4. The old function stays deployed but unused — delete it via AWS Console to save the (negligible) storage cost.

---

## Files of interest

- `apps/api/src/services/remotionLambda.ts` — the Lambda renderer (Motion + MotionDesign)
- `apps/api/src/services/remotion.ts` — the local Chromium renderer (fallback)
- `apps/api/src/pipelines/motion.ts` — uses `isLambdaEnabled()` to pick renderer
- `apps/api/src/pipelines/motion-design.ts` — same
- `apps/api/src/remotion/Root.tsx` — the bundle entry (must match in local + Lambda)
- `packages/video/src/` — React composition components (re-deploy the site after every change)
- `scripts/setup-lambda.sh` — automates Steps 2–4

---

That's it. Once set up, Lambda is invisible — every Motion video just renders 5× faster.
