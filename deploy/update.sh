#!/usr/bin/env bash
# Updates are serialized and never reset or discard local work.
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>"$(git rev-parse --git-common-dir)/source-update.lock"
flock -n 9 || exit 0
[ "$(git branch --show-current)" = main ] || { echo "Hosting checkout must be on main" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Hosting checkout has local changes; update refused" >&2; exit 1; }
git fetch origin main
[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] || exit 0
git merge-base --is-ancestor HEAD origin/main || { echo "main diverged; update refused" >&2; exit 1; }
systemctl --user stop personal-os-stack.service
# Even a failed update must leave supervision enabled.
trap 'systemctl --user start personal-os-stack.service' EXIT
git merge --ff-only origin/main
