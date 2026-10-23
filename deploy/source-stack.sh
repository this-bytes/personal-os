#!/usr/bin/env bash
# Run directly, or under the user service installed by install-service.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f "${PERSONAL_OS_ENV_FILE:-deploy/.env}" ]; then
  set -a
  source "${PERSONAL_OS_ENV_FILE:-deploy/.env}"
  set +a
fi
export PERSONAL_OS_HOST="${PERSONAL_OS_HOST:-0.0.0.0}"
export PERSONAL_OS_DATA_DIR="${PERSONAL_OS_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/personal-os/data}"
# Install only with the stack stopped. Include every manifest, including new workspaces.
fingerprint="$(find apps packages -name node_modules -prune -o -name package.json -type f -print | sort | xargs sha256sum; sha256sum package.json package-lock.json .nvmrc)"
if [ ! -f node_modules/.source-stack-dependencies ] || [ "$(cat node_modules/.source-stack-dependencies)" != "$fingerprint" ]; then
  npm ci --no-audit --no-fund
  npm run verify:dependencies
  printf '%s' "$fingerprint" > node_modules/.source-stack-dependencies
fi
exec node node_modules/tsx/dist/cli.mjs scripts/dev.ts
