#!/usr/bin/env bash
# CLYRO — Remotion Lambda one-shot setup
# ─────────────────────────────────────────────────────────────────────────────
# Automates steps 2-4 of docs/REMOTION_LAMBDA_SETUP.md:
#   • validate AWS IAM policies
#   • deploy the Lambda function
#   • deploy (or update) the Remotion site bundle
#   • print the env vars to copy into Render's clyro-worker service
#
# Prerequisites (must be done BEFORE running this script):
#   • AWS account with an IAM user that has the 4 policies listed in the doc
#   • aws CLI installed and configured (aws sts get-caller-identity must work)
#   • node 20+ installed
#   • repo deps installed (npm install at repo root)
#
# Usage:
#   ./scripts/setup-lambda.sh
#   ./scripts/setup-lambda.sh --region=eu-central-1 --site-name=clyro-motion
#   ./scripts/setup-lambda.sh --redeploy-site-only   # after editing packages/video/

set -euo pipefail

# ─── Auto-detect repo root from this script's location ─────────────────────
# Le script vit dans <repo>/scripts/, donc le repo root = $SCRIPT_DIR/..
# Permet de lancer le script depuis n'importe quel cwd (npm run, alias, etc.).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ─── Defaults ────────────────────────────────────────────────────────────────
REGION="${AWS_REGION:-eu-central-1}"
SITE_NAME="clyro-motion"
MEMORY="3009"
DISK="2048"
TIMEOUT="240"
REDEPLOY_SITE_ONLY=false
SKIP_VALIDATE=false

# ─── Args parsing ────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --region=*)              REGION="${arg#*=}" ;;
    --site-name=*)           SITE_NAME="${arg#*=}" ;;
    --memory=*)              MEMORY="${arg#*=}" ;;
    --disk=*)                DISK="${arg#*=}" ;;
    --timeout=*)             TIMEOUT="${arg#*=}" ;;
    --redeploy-site-only)    REDEPLOY_SITE_ONLY=true ;;
    --skip-validate)         SKIP_VALIDATE=true ;;
    --help|-h)
      cat <<HELP
CLYRO Remotion Lambda setup

Options:
  --region=<aws-region>        AWS region to deploy in (default: eu-central-1)
  --site-name=<name>           Remotion site name (default: clyro-motion)
  --memory=<mb>                Lambda memory in MB (default: 3009)
  --disk=<mb>                  Lambda ephemeral disk in MB (default: 2048)
  --timeout=<sec>              Lambda timeout in seconds (default: 240)
  --redeploy-site-only         Skip policies+function deploy, only update site
  --skip-validate              Skip the policies validate step (faster)
  -h, --help                   Show this help

Run from the repo root.
HELP
      exit 0 ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1 ;;
  esac
done

# ─── Color helpers ───────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${GREEN}▶${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }
header(){ echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

# ─── Sanity checks ───────────────────────────────────────────────────────────
header "Pre-flight checks"

# Must run from repo root (presence of apps/api/package.json is the marker)
if [[ ! -f "apps/api/package.json" ]]; then
  error "Run this script from the repo root (apps/api/package.json not found)"
  exit 1
fi
log "Repo root detected"

# AWS CLI installed?
if ! command -v aws >/dev/null 2>&1; then
  error "AWS CLI not installed. Install: https://aws.amazon.com/cli/"
  exit 1
fi
log "aws CLI: $(aws --version 2>&1)"

# AWS credentials work?
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  error "AWS credentials not configured. Run: aws configure"
  exit 1
fi
CALLER_ARN=$(aws sts get-caller-identity --query Arn --output text)
log "AWS identity: ${CALLER_ARN}"

# Node version OK?
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if (( NODE_MAJOR < 20 )); then
  warn "Node ${NODE_MAJOR} detected — Remotion 4.x recommends Node 20+. Continuing anyway."
fi
log "Node: $(node -v)"

# @remotion/lambda installed?
if [[ ! -d "apps/api/node_modules/@remotion/lambda" ]]; then
  warn "@remotion/lambda not installed in apps/api — running npm install…"
  (cd apps/api && npm install)
fi
log "@remotion/lambda installed"

# ─── Step 1: Validate policies ───────────────────────────────────────────────
if [[ "$REDEPLOY_SITE_ONLY" == "false" && "$SKIP_VALIDATE" == "false" ]]; then
  header "Step 1/3 — Validate IAM policies"
  log "Running: npx remotion lambda policies validate"
  (cd apps/api && AWS_REGION="$REGION" npx remotion lambda policies validate) || {
    error "Policy validation failed — fix the missing IAM permissions and re-run."
    exit 1
  }
  log "All required IAM policies present ✓"
fi

# ─── Step 2: Deploy Lambda function ──────────────────────────────────────────
FUNCTION_NAME=""
if [[ "$REDEPLOY_SITE_ONLY" == "false" ]]; then
  header "Step 2/3 — Deploy Lambda function (region: $REGION, memory: ${MEMORY}MB)"
  log "Running: npx remotion lambda functions deploy --memory=$MEMORY --timeout=$TIMEOUT --disk=$DISK"

  DEPLOY_OUTPUT=$(cd apps/api && AWS_REGION="$REGION" npx remotion lambda functions deploy \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --disk="$DISK" \
    --region="$REGION" 2>&1) || {
    error "Function deploy failed:"
    echo "$DEPLOY_OUTPUT" >&2
    exit 1
  }

  echo "$DEPLOY_OUTPUT"

  # Extract the function name from the output. Remotion prints it as a line like:
  #   Function name: remotion-render-4-0-448-mem3009mb-disk2048mb-240sec
  FUNCTION_NAME=$(echo "$DEPLOY_OUTPUT" | grep -oE 'remotion-render-[0-9a-z\-]+' | head -1)
  if [[ -z "$FUNCTION_NAME" ]]; then
    # Fallback: list deployed functions and pick the one matching our specs
    FUNCTION_NAME=$(cd apps/api && AWS_REGION="$REGION" npx remotion lambda functions ls --region="$REGION" --quiet 2>/dev/null | grep -E "mem${MEMORY}mb-disk${DISK}mb-${TIMEOUT}sec" | head -1 | awk '{print $1}')
  fi

  if [[ -z "$FUNCTION_NAME" ]]; then
    warn "Could not auto-detect function name from output. Run \`npx remotion lambda functions ls\` and copy it manually."
  else
    log "Function deployed: ${BOLD}${FUNCTION_NAME}${NC}"
  fi
else
  log "Skipping function deploy (--redeploy-site-only)"
fi

# ─── Step 3: Deploy / update site bundle ─────────────────────────────────────
header "Step 3/3 — Deploy site bundle (name: $SITE_NAME)"
log "Running: npx remotion lambda sites create src/remotion/Root.tsx --site-name=$SITE_NAME"

SITE_OUTPUT=$(cd apps/api && AWS_REGION="$REGION" npx remotion lambda sites create \
  src/remotion/Root.tsx \
  --site-name="$SITE_NAME" \
  --region="$REGION" 2>&1) || {
  error "Site deploy failed:"
  echo "$SITE_OUTPUT" >&2
  exit 1
}

echo "$SITE_OUTPUT"

# Extract the serve URL from the output. Remotion prints:
#   Serve URL: https://remotionlambda-…s3.eu-central-1.amazonaws.com/sites/clyro-motion/index.html
SERVE_URL=$(echo "$SITE_OUTPUT" | grep -oE 'https://remotionlambda-[a-z0-9\-]+\.s3\.[a-z0-9\-]+\.amazonaws\.com/sites/[^[:space:]]+' | head -1)
if [[ -z "$SERVE_URL" ]]; then
  warn "Could not auto-detect serve URL from output. Run \`npx remotion lambda sites ls\` and copy it manually."
else
  log "Site deployed: ${BOLD}${SERVE_URL}${NC}"
fi

# ─── Final summary ───────────────────────────────────────────────────────────
header "✅ Setup complete — copy these env vars to Render's clyro-worker service"

cat <<ENV

USE_REMOTION_LAMBDA=true
AWS_REGION=$REGION
AWS_ACCESS_KEY_ID=<your-iam-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-iam-secret-access-key>
REMOTION_LAMBDA_FUNCTION_NAME=${FUNCTION_NAME:-<copy-from-output-above>}
REMOTION_LAMBDA_SERVE_URL=${SERVE_URL:-<copy-from-output-above>}

ENV

cat <<NEXT
Next steps:
  1. Render Dashboard → clyro-worker → Environment → add the 6 vars above.
  2. Render auto-redeploys the worker (~2 min).
  3. Generate a Motion Design video — worker logs should show:
       "MotionDesign: using Lambda renderer"

To re-deploy the site only (after changing packages/video/src/):
  ./scripts/setup-lambda.sh --redeploy-site-only --region=$REGION

To disable Lambda later: set USE_REMOTION_LAMBDA=false on the worker.

Full guide: docs/REMOTION_LAMBDA_SETUP.md
NEXT
