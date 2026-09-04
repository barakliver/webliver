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

# ── prove the backup actually works, before trusting it ─────────────────────
# The agent's whole promise — that an automatic update cannot destroy data — is
# one pg_dump. So it is run here, for real, while somebody is watching.
#
# The failure this catches: pg_dump refuses point blank to dump a server newer
# than itself, and Ubuntu ships whatever client its release froze on while
# Supabase moved on. That mismatch does not show up until the first release,
# at which point the agent correctly refuses to deploy and the reason is a line
# in a log nobody is reading.
echo "→ testing the backup against the real database"
DB_URL="$(grep -E '^DATABASE_URL=' "$ENVFILE" | cut -d= -f2-)"
if pg_dump --schema-only --no-owner --no-privileges "$DB_URL" >/dev/null 2>/tmp/pgdump-test.err; then
  echo "  backup works  (pg_dump $(pg_dump --version | awk '{print $3}'))"
else
  echo
  echo "  the backup did NOT work, and the agent will refuse to deploy without one."
  echo
  sed 's/^/      /' /tmp/pgdump-test.err
  echo
  if grep -qi 'server version\|aborting' /tmp/pgdump-test.err; then
    cat <<'EOF'
  This is the version mismatch: the installed pg_dump is older than the
  database server, and it will not dump forwards. Install a current client:

      install -d /usr/share/postgresql-common/pgdg
      curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        https://www.postgresql.org/media/keys/ACCC4CF8.asc
      echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
      apt-get update -qq && apt-get install -y postgresql-client-17

  then run this installer again.
EOF
  else
    echo "  Check DATABASE_URL in $ENVFILE — most often it is the wrong host,"
    echo "  or the password was pasted with the [YOUR-PASSWORD] placeholder left in."
  fi
  rm -f /tmp/pgdump-test.err
  echo
  echo "  the timer was NOT enabled. Nothing on the server changed."
  exit 1
fi
rm -f /tmp/pgdump-test.err

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

# ── somewhere to go back to ─────────────────────────────────────────────────
# The first automatic release is the one with nothing behind it. The agent
# rolls back to whatever it last put live, and on its first run that is
# nothing, so a first release that failed its checks would sit there broken
# with no way back — the one moment the safety net has a hole in it.
#
# Whatever is checked out on this machine right now is, by definition, the
# thing that has been serving the site. Recording its commit closes the hole:
# the agent hands that to git checkout exactly as it would a tag, so the first
# release can fall back to the version that was working an hour ago.
STATE_DIR=/var/lib/liver-agent
mkdir -p "$STATE_DIR"
if [ ! -s "$STATE_DIR/deployed" ]; then
  LIVE="$(git -C "$REPO" rev-parse HEAD)"
  printf '%s' "$LIVE" > "$STATE_DIR/deployed"
  echo "→ the version serving now (${LIVE:0:7}) is the rollback point for the first release"
fi

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
