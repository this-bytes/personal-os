# syntax=docker/dockerfile:1

# Personal OS is built as one image with two runtime targets: the API
# server and the execution worker. They share the same code and the same
# data volume, and differ only in the command they run.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false

# better-sqlite3 ships prebuilt binaries for glibc. Alpine (musl) has none,
# so the image is Debian based rather than Alpine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so the layer is cached across code changes.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/agent-adapters/package.json packages/agent-adapters/
COPY packages/ui/package.json packages/ui/
COPY apps/server/package.json apps/server/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY . .

# Build every workspace in dependency order.
RUN npm run verify:dependencies \
  && npm run build \
  && npm prune --omit=dev --workspaces --include-workspace-root


FROM base AS server
ENV NODE_ENV=production \
    PERSONAL_OS_HOST=0.0.0.0 \
    PERSONAL_OS_PORT=4317 \
    PERSONAL_OS_DATA_DIR=/data
EXPOSE 4317
# The web client is served by the API process when it is present.
VOLUME ["/data"]
CMD ["node", "apps/server/dist/index.js"]


FROM base AS worker
ENV NODE_ENV=production \
    PERSONAL_OS_DATA_DIR=/data
VOLUME ["/data"]
CMD ["node", "apps/worker/dist/index.js"]
