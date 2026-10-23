#!/usr/bin/env bash
# Install for the current user. Environment file contains shell assignments.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
node_dir="$(dirname "$(command -v node)")"
config="${XDG_CONFIG_HOME:-$HOME/.config}/personal-os"
units="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$config" "$units"
if [ ! -f "$config/stack.env" ]; then
  install -m 600 "$root/deploy/.env.example" "$config/stack.env"
fi
# ExecStart arguments and Environment assignments use systemd quoting.
cat > "$units/personal-os-stack.service" <<EOF
[Unit]
Description=Personal OS source stack
After=network-online.target
StartLimitIntervalSec=0
[Service]
WorkingDirectory=$root
Environment="PATH=$node_dir:/usr/local/bin:/usr/bin:/bin"
Environment="PERSONAL_OS_ENV_FILE=$config/stack.env"
ExecStart=/bin/bash "$root/deploy/source-stack.sh"
Restart=always
RestartSec=5
KillMode=mixed
TimeoutStopSec=1900
[Install]
WantedBy=default.target
EOF
cat > "$units/personal-os-update.service" <<EOF
[Unit]
Description=Pull Personal OS main and restart the source stack
[Service]
Type=oneshot
WorkingDirectory=$root
ExecStart=/bin/bash "$root/deploy/update.sh"
TimeoutStartSec=2000
EOF
cat > "$units/personal-os-update.timer" <<'EOF'
[Unit]
Description=Check Personal OS main every 30 seconds
[Timer]
OnBootSec=30
OnUnitInactiveSec=30
[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable personal-os-stack.service personal-os-update.timer
systemctl --user restart personal-os-stack.service personal-os-update.timer
printf 'Panel: http://localhost:5173; logs: journalctl --user -u personal-os-stack -f\n'
