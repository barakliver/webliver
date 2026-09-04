#!/usr/bin/env bash
# ============================================================================
#  Install the release agent. Run once, on the droplet, as root.
#
#      bash /root/webliver/scripts/install-agent.sh
#
#  After this, pushing a tag named `release-something` puts that commit live
#  within five minutes, and nothing else does. Pushing to the branch all day
#  changes nothing.
#
#  A timer rather than a webhook. A webhook needs an open port, a shared
#  secret, and something listening on a machine with a gigabyte of memory; a
#  timer needs none of those and the cost of the difference is that a release
#  goes out within five minutes rather than within five seconds, which nobody
#  will ever notice.
#
#  To stop it:      systemctl disable --now liver-agent.timer
#  To watch it:     journalctl -u liver-agent -f
#  To see the log:  tail -f /var/lib/liver-agent/agent.log
# ============================================================================
set -euo pipefail

REPO="${REPO:-/root/webliver}"
ENVFILE="${ENVFILE:-/etc/liver-next.env}"

if [ "$(id -u)" -ne 0 ]; then
  echo "run this as root"; exit 1
fi

echo "→ checking what the agent needs"

missing=0

if ! command -v psql >/dev/null 2>&1; then
  echo "  installing postgresql-client"
  apt-get update -qq && apt-get install -y -qq postgresql-client
fi

if ! grep -qE '^DATABASE_URL=' "$ENVFILE" 2>/dev/null; then
  cat <<'EOF'

  DATABASE_URL is not in the environment file, and the agent cannot apply a
  schema without it. It is the one thing nobody can add for you.

  Supabase → Project Settings → Database → Connection string → URI.
  It looks like:

      postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

  Then:

      echo 'DATABASE_URL=postgresql://…' >> /etc/liver-next.env
      chmod 600 /etc/liver-next.env

  and run this installer again.

EOF
  missing=1
fi

[ "$missing" -eq 1 ] && exit 1

echo "→ writing the service"
cat > /etc/systemd/system/liver-agent.service <<EOF
[Unit]
Description=Put a marked release live, and put it back if it does not work
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO
ExecStart=/usr/bin/env bash $REPO/scripts/agent-deploy.sh
# A build on this machine takes minutes and can wait on the network. Half an
# hour is generous; a run that is still going after that is stuck, not slow.
TimeoutStartSec=1800
# The deploy already handles its own failure and rolls back. A systemd restart
# on top of that would start a second build while the first is still cleaning
# up, which on a gigabyte of memory kills both.
Restart=no
EOF

echo "→ writing the timer"
cat > /etc/systemd/system/liver-agent.timer <<'EOF'
[Unit]
Description=Look for a marked release every five minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=5min
# Without this every machine running this file wakes at the same instant. It
# is one machine, but the habit costs nothing.
RandomizedDelaySec=30s
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now liver-agent.timer

echo
echo "the agent is running."
echo
echo "  it checks every five minutes and does nothing unless a tag matching"
echo "  release-* points at a commit it has not deployed yet."
echo
echo "  watch it:   journalctl -u liver-agent -f"
echo "  its log:    tail -f /var/lib/liver-agent/agent.log"
echo "  stop it:    systemctl disable --now liver-agent.timer"
echo
echo "  try it now without deploying anything:"
echo "      bash $REPO/scripts/agent-deploy.sh --dry"
echo
