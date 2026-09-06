#!/usr/bin/env bash
# ============================================================================
#  Install the release agent. Run once, on the droplet, as root.
#
#      bash /root/webliver/scripts/install-agent.sh
#
#  After this, moving the `release` branch onto a commit puts that commit live
#  within five minutes, and nothing else does. Pushing to design-overhaul all
#  day changes nothing. A tag named `release-something` still works and is read
#  only when the branch does not exist — the branch is the marker, because the
#  assistant that writes the code can push a branch and cannot push a tag, and
#  a tag-only marker meant every release still needed a person at a keyboard.
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

LINES="$(grep -cE '^DATABASE_URL=' "$ENVFILE" 2>/dev/null || true)"

if [ "${LINES:-0}" -eq 0 ]; then
  cat <<'EOF'

  DATABASE_URL is not in the environment file, and the agent cannot apply a
  schema without it. It is the one thing nobody can add for you.

  There is a command that asks for it and writes it, so that nothing in the
  command itself has to be edited:

      bash /root/webliver/scripts/set-db-url.sh

  Then run this installer again.

EOF
  missing=1
fi

# ── more than one of them ───────────────────────────────────────────────────
# This one cost a whole round. Everything that reads this file does
# `grep '^DATABASE_URL=' | cut -d= -f2-`, which takes the FIRST match — so a
# corrected line appended under a broken one changes nothing, and the error
# message stays word for word identical however many times it is fixed. The
# obvious reading of that is that the fix did not save.
if [ "${LINES:-0}" -gt 1 ]; then
  cat <<EOF

  There are $LINES DATABASE_URL lines in $ENVFILE, and everything that reads
  this file uses the first one. So whichever you added most recently is being
  ignored, and fixing it again by adding another will not change that.

  This replaces all of them with one:

      bash /root/webliver/scripts/set-db-url.sh

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
DB_URL="$(grep -E '^DATABASE_URL=' "$ENVFILE" | cut -d= -f2-)"

# Before the network is involved at all: is this a connection string, or is it
# the shape of one with the placeholder still in it? Both fail, but they fail
# with completely different errors — a leftover placeholder comes back as
# "could not translate host name", which reads like a DNS problem and sends
# somebody to check their network for something that was never a network
# problem. Naming it here costs one case statement.
bad=""
case "$DB_URL" in
  *…*)                     bad="it still contains the … from the example — that was a placeholder, not part of the string" ;;
  *'[YOUR-PASSWORD]'*)     bad="it still contains [YOUR-PASSWORD] — Supabase prints that where your real password goes" ;;
  *PASTE_THE_WHOLE_URI*)   bad="it still contains PASTE_THE_WHOLE_URI_HERE, which was the placeholder, not the value" ;;
  postgres://*|postgresql://*) ;;
  *)                       bad="it does not start with postgresql://" ;;
esac

if [ -n "$bad" ]; then
  echo
  echo "  DATABASE_URL is in $ENVFILE, but $bad."
  echo
  echo "  This asks for the string and replaces the line — nothing in the"
  echo "  command has to be edited, which is how the wrong thing got in there:"
  echo
  echo "      bash $REPO/scripts/set-db-url.sh"
  echo
  echo "  the timer was NOT enabled. Nothing on the server changed."
  exit 1
fi

echo "→ testing the backup against the real database"
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
echo "  it checks every five minutes and does nothing unless the release branch"
echo "  points at a commit it has not deployed yet."
echo
echo "  watch it:   journalctl -u liver-agent -f"
echo "  its log:    tail -f /var/lib/liver-agent/agent.log"
echo "  stop it:    systemctl disable --now liver-agent.timer"
echo
echo "  try it now without deploying anything:"
echo "      bash $REPO/scripts/agent-deploy.sh --dry"
echo
