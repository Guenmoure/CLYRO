# ── Build stage ───────────────────────────────────────────────────────────────
# Using Debian-based image because Remotion's headless Chrome binary is linked
# against glibc and does not run on Alpine/musl.
FROM node:20-bookworm-slim AS builder

# FFmpeg + build tools + Chromium runtime shared libs required by Remotion's
# chrome-headless-shell at both download time (postinstall) and render time.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      make \
      g++ \
      ca-certificates \
      wget \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      fonts-liberation \
      fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo manifests first (better layer caching)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/video/package.json  ./packages/video/
COPY apps/api/package.json         ./apps/api/

# Install all workspace dependencies from monorepo root
RUN npm ci --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/video/  ./packages/video/
COPY apps/api/        ./apps/api/

# Build shared packages first, then API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# Pre-download Remotion's headless Chrome into node_modules/.remotion so it's
# baked into the image (no first-render stall on Render, no runtime download
# failures when the container has no outbound access to storage.googleapis.com).
# Non-fatal: if the CLI command is unavailable or the download hiccups, Remotion
# will retry on first use.
RUN cd apps/api && npx --yes remotion@4.0.448 browser ensure \
      || echo "remotion browser ensure failed; will download on first render"

# ── Production stage ───────────────────────────────────────────────────────────
# Same Debian-slim base as builder to keep the Chrome binary runnable.
FROM node:20-bookworm-slim AS production

# ffmpeg + Chromium runtime shared libs + wget (used by HEALTHCHECK below) +
# python3 (runtime for yt-dlp, used by F5 Studio YouTube transcription).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      ca-certificates \
      wget \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      fonts-liberation \
      fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp — single self-contained binary from GitHub releases. Requires python3
# at runtime (see apt block above) + ffmpeg (already present) to merge best
# audio stream. Pinned to a specific release for reproducibility; bump
# manually when YouTube breaks the current version.
ARG YT_DLP_VERSION=2025.09.26
RUN wget -qO /usr/local/bin/yt-dlp \
      "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
  && chmod +x /usr/local/bin/yt-dlp \
  && /usr/local/bin/yt-dlp --version

WORKDIR /app

# Copy only what's needed at runtime
COPY --from=builder /app/node_modules                  ./node_modules
COPY --from=builder /app/package.json                  ./package.json
COPY --from=builder /app/packages/shared/dist          ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json  ./packages/shared/package.json
# @clyro/video is a workspace package consumed at runtime by Remotion's Webpack
# bundler (see apps/api/src/remotion/*). Its package.json points "main" directly
# at src/index.ts, so there's no dist to copy — we ship the TS sources and let
# Remotion's bundler compile them on demand.
COPY --from=builder /app/packages/video/src            ./packages/video/src
COPY --from=builder /app/packages/video/package.json   ./packages/video/package.json
COPY --from=builder /app/apps/api/dist                 ./apps/api/dist
COPY --from=builder /app/apps/api/package.json         ./apps/api/package.json

ENV NODE_ENV=production

EXPOSE 4000

# Health check uses $PORT env var if set (Render passes it), falls back to 4000.
# --start-period=60s gives Node time to cold-start (imports, Sentry init,
#   Remotion module load) before the first check can fail.
# --timeout=10s tolerates brief event-loop stalls (GC pauses, short CPU spikes)
#   without killing the container. The deeper fix is moving heavy work off the
#   API process (BullMQ worker service + streaming /mix-audio) — see next steps.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD wget -qO- "http://localhost:${PORT:-4000}/health" || exit 1

CMD ["node", "apps/api/dist/index.js"]
