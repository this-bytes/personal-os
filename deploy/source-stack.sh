#!/usr/bin/env bash
#
# Personal OS — run the instance from source, and reach it from the Windows host.
#
# The Compose stack beside this file is the shipped deployment: it runs the
# compiled code in a container, and bringing new code to a running deployment
# means building the images again. This script runs the same three processes
# from the checkout instead, so a change reaches the running instance as it is
# written — no image, no build, no wait.
#
#   bash deploy/source-stack.sh             # start the instance from source
#   bash deploy/source-stack.sh --publish   # also publish it to the Windows host
#
# It starts the same stack as `npm run dev:stack`, and does three things for
# it that the bare command leaves to you:
#
#   - the secret key and the data directory are the ones in `deploy/.env`, so
#     the source instance opens the same database and can decrypt the
#     configuration the deployment encrypted;
#   - the stack binds every interface, so the host can reach it;
#   - on WSL, the checkout is checked to be on the Linux filesystem, because the
#     native modules are built for the platform they run on, and SQLite needs a
#     filesystem that locks the way SQLite expects.
#
# --publish is what it takes for another machine on the network to reach the
# instance. Windows forwards a listener in the distribution to the host's
# loopback address, and not to the host's address on the network, and the
# host's firewall refuses traffic it did not originate — so the port has to be
# opened on the host: either with an elevated firewall rule, or by letting
# Docker Desktop publish it, which writes the rule with the publish. The
# published container forwards to a jump port inside the distribution, because
# a container cannot target a port the host already publishes to it, and
# because the container reaches the host through its loopback, which leaves
# the jump port closed to the network.
#
# Nothing here is required to run the product. It is the runbook for running
# the product on a Windows host from WSL.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# The port the client is published on, and the port the published instance
# forwards to. The API port is published as well, and both land on the client:
# the client serves the panel and proxies the API, so one published port
# carries the instance exactly as the Compose deployment's port does.
api_port="${PERSONAL_OS_PORT:-4317}"
web_port="${PERSONAL_OS_WEB_PORT:-5173}"
jump_port="${PERSONAL_OS_JUMP_PORT:-14317}"
container_name="${PERSONAL_OS_PUBLISH_CONTAINER:-personal-os-lan}"

publish=0

usage() {
  cat <<'USAGE'
Personal OS — run the instance from source, and reach it from the Windows host.

  bash deploy/source-stack.sh             start the instance from source
  bash deploy/source-stack.sh --publish   also publish it to the Windows host

The stack runs from the checkout, so a change reaches the running instance as
it is written. The secret key and the data directory come from deploy/.env, so
the instance opens the same database as the deployment.

--publish opens the client on 5173 and the instance on 4317 on the Windows
host, through Docker Desktop, which writes the host's firewall rule with the
publish. It is for WSL: on a native host the ports are already the host's.
USAGE
}

for argument in "$@"; do
  case "$argument" in
    --publish) publish=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $argument" >&2
      usage >&2
      exit 2
      ;;
  esac
done

say() {
  printf '\n== %s\n' "$*"
}

# Is this a WSL distribution? The environment says so on every current release,
# and the kernel release string says so on the older ones.
is_wsl=0
if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
  is_wsl=1
fi

# The native modules are built for the platform they run on, and a Windows
# filesystem mounted into the distribution is unsuitable for this launcher's
# runtime data and SQLite locking. npm installs for the Node platform, so keep
# a separate Linux installation in the distribution's own filesystem.
if [ "$is_wsl" = 1 ]; then
  case "$root" in
    /mnt/*)
      say "the checkout is on a Windows filesystem"
      echo "   $root"
      echo
      echo "On WSL the checkout has to be on the Linux filesystem: the native"
      echo "modules are built for the platform they run on, and SQLite needs a"
      echo "filesystem that locks the way SQLite expects."
      echo
      echo "   git clone /mnt/g/code/personal-os ~/code/personal-os"
      echo "   cd ~/code/personal-os && npm ci"
      echo "   bash deploy/source-stack.sh"
      exit 1
      ;;
  esac
fi

# Node installed by a version manager is not on a non-interactive shell's
# PATH, and a script that cannot find node cannot start the stack.
if ! command -v node >/dev/null 2>&1; then
  nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    export NVM_DIR="$nvm_dir"
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is not on the PATH. Node 22.13 or newer is needed." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  say "installing the dependencies"
  npm ci
fi

# The deployment's own configuration, so the source instance and the deployment
# read the same database and the same secret key. Without the key the instance
# generates one, and the configuration the deployment encrypted stays unreadable.
if [ -f deploy/.env ]; then
  set -a
  # shellcheck disable=SC1091
  . deploy/.env
  set +a
  say "loaded deploy/.env"
fi

# Every interface, so the host — and the host's network — can reach it.
export PERSONAL_OS_HOST="${PERSONAL_OS_HOST:-0.0.0.0}"
export PERSONAL_OS_PORT="$api_port"
export PERSONAL_OS_WEB_PORT="$web_port"

if [ "$publish" = 1 ]; then
  if [ "$is_wsl" = 0 ]; then
    echo "--publish is for WSL: on a native host the ports are already the host's." >&2
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is not on the PATH. Publishing the ports needs Docker Desktop's engine." >&2
    exit 1
  fi

  # A publish left over from an earlier run holds the ports the stack is about
  # to bind, and the launcher refuses to start when it finds them taken. The
  # publish is put back once the stack is running.
  docker rm -f "$container_name" >/dev/null 2>&1 || true
fi

say "starting the instance from source"
echo "   panel:  http://127.0.0.1:$web_port"
echo "   api:    http://127.0.0.1:$api_port"
echo
echo "A change to the server, the worker, the contracts or the adapters reaches"
echo "the running instance as it is written. The client reloads in place."

# The stack runs in the background, because the publish follows it: the
# published ports are the ports the stack binds, and the launcher refuses to
# start when it finds them taken.
npm run dev:stack &
stack_pid=$!

stop_stack() {
  if kill -0 "$stack_pid" 2>/dev/null; then
    kill "$stack_pid" 2>/dev/null || true
  fi
}
trap stop_stack EXIT INT TERM

say "waiting for the instance to answer"
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$api_port/api/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$stack_pid" 2>/dev/null; then
    echo "the stack stopped before it became healthy." >&2
    wait "$stack_pid" || true
    exit 1
  fi
  sleep 1
done

if [ "$publish" = 1 ]; then
  # The jump port: a listener inside the distribution that the published
  # container can reach. The container cannot reach the distribution's address
  # directly, and it cannot target a port the host publishes to it, so it
  # targets a port nothing else publishes.
  proxyd=""
  for candidate in /usr/lib/systemd/systemd-socket-proxyd /lib/systemd/systemd-socket-proxyd; do
    if [ -x "$candidate" ]; then
      proxyd="$candidate"
      break
    fi
  done
  if [ -z "$proxyd" ]; then
    echo "systemd-socket-proxyd was not found, so the jump port cannot be started." >&2
    echo "Install systemd, or publish the ports by hand." >&2
    exit 1
  fi

  unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  mkdir -p "$unit_dir"

  cat >"$unit_dir/personal-os-source.socket" <<SOCKET
[Unit]
Description=Personal OS — the jump port the published instance forwards to

[Socket]
ListenStream=$jump_port
Accept=no
Service=personal-os-source.service

[Install]
WantedBy=sockets.target
SOCKET

  cat >"$unit_dir/personal-os-source.service" <<SERVICE
[Unit]
Description=Personal OS — forward the jump port to the web client
Requires=personal-os-source.socket
After=personal-os-source.socket

[Service]
ExecStart=$proxyd 127.0.0.1:$web_port
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
SERVICE

  say "starting the jump port on $jump_port"
  systemctl --user daemon-reload
  systemctl --user enable --now personal-os-source.socket

  say "publishing $api_port and $web_port on the host"
  docker run -d \
    --name "$container_name" \
    --restart unless-stopped \
    --entrypoint sh \
    -p "$api_port:$api_port" \
    -p "$web_port:$web_port" \
    alpine/socat \
    -c "socat TCP-LISTEN:$api_port,fork,reuseaddr TCP:host.docker.internal:$jump_port & socat TCP-LISTEN:$web_port,fork,reuseaddr TCP:host.docker.internal:$jump_port & wait"

  say "the instance is published"
  echo "   the panel:    http://<the host's address>:$web_port"
  echo "   the instance: http://<the host's address>:$api_port"
  echo
  echo "   Both addresses serve the panel, and the API is proxied under them."
  echo "   The port is open on the host because Docker Desktop published it;"
  echo "   the host's firewall rule was written with the publish."
fi

wait "$stack_pid"
