# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# FFmpeg + build tools (needed for some native npm packages)
RUN apk add --no-cache ffmpeg python3 make g++

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

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache ffmpeg

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

# Health check uses $PORT env var if set (Render passes it), falls back to 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://localhost:${PORT:-4000}/health" || exit 1

CMD ["node", "apps/api/dist/index.js"]
