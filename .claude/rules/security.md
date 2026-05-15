# Security Rules — CLYRO

These rules apply to every code change in this repository. Adapted from
the OWASP LLM Top 10 + Veracode 2025 + CSA RAILGUARD + Supabase RLS
best practices, tightened for our actual stack (Next.js App Router on
Vercel, Express API on Render, Supabase Postgres + Storage).

## Secrets & API keys

- **No hardcoded keys**. Stripe, HeyGen, fal.ai, ElevenLabs, Anthropic,
  Supabase keys all live in `.env*` (never committed) — never inline.
- `.env`, `.env.local`, `.env.staging`, `.env.production`, `.env.test`,
  and `*.env` are in `.gitignore` (verified). Only `.env.example` and
  `.env.test.example` ship with placeholders (`sk_live_...`).
- **Client vs server split**:
  - `apps/web` only ever sees `NEXT_PUBLIC_*` vars. Anything else
    leaks to the JS bundle.
  - `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `HEYGEN_API_KEY`,
    `FAL_KEY`, `ANTHROPIC_API_KEY` are **backend only** (`apps/api`).
- **Never send a secret in a URL query string** (logged by Vercel/Render
  and visible in the Referer header).

## Supabase RLS

- Every table in `public.*` MUST have `ENABLE ROW LEVEL SECURITY`.
  Current coverage: 13/13 tables ✓ (see `supabase/migrations/`).
- Policies always use `auth.uid()`, **never** `auth.jwt() ->>
  'user_metadata'` (users can update their own metadata client-side).
- Every `UPDATE`/`INSERT` policy MUST include a `WITH CHECK` clause —
  without it, a user can update a row to point at another user's id.
- The service-role key bypasses RLS by design. It is allowed only:
  - Inside `apps/api` Express routes (server-side, never streamed to
    the client).
  - Inside Next.js API routes that have already verified `getUser()`
    via `createRouteHandlerClient({ cookies })`.
  - Inside webhook handlers AFTER signature verification.
- `apps/web` clients use the anon key only.

## Auth on every API route

- Every route in `apps/web/app/api/**/route.ts` MUST start with
  `getUser()` from `createRouteHandlerClient({ cookies })` and return
  401 if there is no user. Exceptions are explicit and documented in
  the route comment block:
  - `auth/callback` — OAuth handshake, runs before session exists.
  - Public webhook endpoints — signature-verified instead.
- `apps/api` routes use `authMiddleware` (Express). Always required
  except the health check and webhook endpoints.
- `draft-save` (the sendBeacon endpoint) MUST verify a Supabase
  access_token in the request body (cookies don't survive sendBeacon)
  AND verify that `req.body.draftId` belongs to the resolved user
  before any write.

## Cost-amplification protection

- Any route that calls a billable third-party API (fal.ai, Anthropic,
  HeyGen, ElevenLabs) MUST:
  1. Authenticate the caller (no anonymous billing).
  2. Apply a rate-limit at the workspace level (`apiLimiter`,
     `pipelineLimiter`, or `voiceCloneLimiter` from
     `apps/api/src/index.ts`).
  3. Where applicable, deduct credits BEFORE the upstream call so a
     timeout still bills the user, not us.

## Inputs & injections

- Supabase queries use the JS client's chained methods (`.eq()`,
  `.in()`, `.rpc()`) — never string-concatenate SQL. There's no
  `db.query("... " + x)` pattern in the repo today; keep it that way.
- Zod schemas validate the request body of every Express route. Same
  contract for Next API routes (use `safeParse`).
- **Never** use `dangerouslySetInnerHTML` with content that could come
  from a user, a CMS, or an i18n string the user might influence. The
  11 current usages render LOCAL static content; if any of them ever
  start consuming non-trusted input, sanitize via `rehype-sanitize` or
  switch to plain text.
- No `eval`, `new Function`, no dynamic `import(userInput)`.

## CORS, headers, transport

- Express CORS = explicit allowlist + Vercel preview regex. Never `*`.
- Helmet is enabled with: CSP `defaultSrc 'self'`, `frameSrc 'none'`,
  `objectSrc 'none'`, HSTS `maxAge 2 years` preload. Don't loosen
  without a written reason.
- HTTPS only in prod (HSTS enforces it).
- Body size limit 10 MB on `express.json`. Don't raise without
  reviewing what calls it.

## Rate limiting (Express)

Three tiers configured in `apps/api/src/index.ts`:
- `apiLimiter` — 100 req / 15 min (global).
- `pipelineLimiter` — 20 generations / hour (faceless, motion, studio).
- `voiceCloneLimiter` — 5 clones / hour.

Add a new limiter only if existing tiers don't fit the cost profile.
Next.js API routes do NOT have a built-in limiter today — defer
expensive work to `apps/api` whenever possible, or add per-route
limiting via Upstash if the route must stay in Next.

## Webhooks

- Stripe + HeyGen + Moneroo handlers verify HMAC signature against the
  raw body BEFORE parsing. `express.json()` runs after the webhook
  routes for that reason.
- Webhook secrets live in env vars (`STRIPE_WEBHOOK_SECRET`,
  `HEYGEN_WEBHOOK_SECRET`, `MONEROO_WEBHOOK_SECRET`).

## Dependencies

- Run `npm audit` on each workspace (`apps/api`, `apps/web`,
  `packages/shared`) before merging anything that touches `package.json`.
- If a new package has <1 000 weekly downloads on npm, justify it in the
  PR description.
- Pin majors in `package.json` (`"^3.4.2"`); the lockfile pins the rest.

## Deployment checklist (per release)

- [ ] No new hardcoded secret
- [ ] `npm audit` clean (or known-low + documented)
- [ ] New tables have RLS + auth.uid() policies + WITH CHECK
- [ ] New Next routes have `getUser()` at line 1
- [ ] New Express routes have `authMiddleware` + Zod schema
- [ ] Stack traces are NOT exposed in production (only req id)
- [ ] CORS allowlist updated if new front-end domain
