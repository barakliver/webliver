#!/usr/bin/env bash
# ============================================================================
#  Make the nightly sweep callable, and schedule it.
#
#      bash /root/webliver/scripts/set-cron-key.sh
#
#  The sweep at /api/cron closes finished events, sends the anniversary
#  reminders, and once a week the budget letter (Sunday) and the supplier
#  letter (Monday). It refuses every call without a shared key, and the key
#  was never written on this machine, so every call has answered "not
#  configured" and the sweep has never run.
#
#  Nothing to paste: the key is generated here, written to the environment
#  file, and put into the crontab lines that call the sweep. The app is
#  restarted so it reads the same key. Safe to run again; it replaces its
#  own lines and nothing else.
# ============================================================================
set -euo pipefail

ENVFILE="${ENVFILE:-/etc/liver-next.env}"
APP="${APP:-/root/webliver/liver-next}"
HOST="${HOST:-https://liverproductions.com}"
TAG="# liver-sweep"

if [ "$(id -u)" -ne 0 ]; then
  echo "run this as root"; exit 1
fi
if [ ! -f "$ENVFILE" ]; then
  echo "$ENVFILE does not exist. Run deploy-next.sh first."; exit 1
fi

# ── the key ─────────────────────────────────────────────────────────────────
# Kept if one exists, so a re-run to fix the crontab does not rotate it.
KEY="$(grep -E '^CRON_KEY=.+' "$ENVFILE" | head -1 | cut -d= -f2- || true)"
if [ -z "$KEY" ]; then
  KEY="$(head -c 32 /dev/urandom | base64 | tr -d '+/=' | head -c 40)"
  TMP="$(mktemp)"
  grep -vE '^CRON_KEY=' "$ENVFILE" > "$TMP" || true
  printf 'CRON_KEY=%s\n' "$KEY" >> "$TMP"
  cat "$TMP" > "$ENVFILE"; rm -f "$TMP"; chmod 600 "$ENVFILE"
  echo "  a new CRON_KEY was written to $ENVFILE"
else
  echo "  CRON_KEY already in $ENVFILE; keeping it"
fi

# The running app reads the file on start; the checkout's copy is what the
# documented hand-run reads.
[ -d "$APP" ] && cp "$ENVFILE" "$APP/.env.local" || true
if systemctl is-enabled --quiet liver-next 2>/dev/null; then
  systemctl restart liver-next
  echo "  the app restarted with it"
fi

# ── the schedule ────────────────────────────────────────────────────────────
# Three lines, each reading the key from the environment file at run time,
# so rotating the key never needs the crontab touched:
#   nightly at 04:17: close events, anniversaries, and the weekly letters on
#                     their weekday;
#   Sunday 09:00:     the budget letter at the hour it was asked for;
#   Monday 08:00:     the supplier letter at the hour it was asked for.
# The weekly letters are once per week per event, so the extra runs are
# quiet when the nightly one already sent them.
CALL="curl -sS -m 120 -X POST -H \"x-cron-key: \$(grep '^CRON_KEY=' $ENVFILE | cut -d= -f2-)\""
LINES="17 4 * * * $CALL $HOST/api/cron >> /var/log/liver-sweep.log 2>&1 $TAG
0 9 * * 0 $CALL '$HOST/api/cron?job=digest' >> /var/log/liver-sweep.log 2>&1 $TAG
0 8 * * 1 $CALL '$HOST/api/cron?job=vendors' >> /var/log/liver-sweep.log 2>&1 $TAG"

( crontab -l 2>/dev/null | grep -v "$TAG" || true; printf '%s\n' "$LINES" ) | crontab -
echo "  the sweep is scheduled: nightly 04:17, Sunday 09:00, Monday 08:00"

# ── prove it ────────────────────────────────────────────────────────────────
# The app was restarted a moment ago and takes a few seconds to answer again.
# A call in that gap gets Caddy's empty 502 and proves nothing, so wait for
# the front page first, then show the status code with the body.
printf '  waiting for the app to come back up'
for _ in $(seq 1 45); do
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$HOST/" || true)"
  case "$code" in 200|3??) break ;; esac
  printf '.'; sleep 2
done
echo
echo
echo "  calling the sweep once now:"
printf '  '
curl -sS -m 120 -X POST -H "x-cron-key: $KEY" -w '\n  HTTP %{http_code}\n' "$HOST/api/cron" || echo "(the call did not go through)"
echo
echo '  {"ok":true,...} with "errors":[] means it works.'
echo '  "not configured" means SUPABASE_SERVICE_ROLE_KEY is missing:  bash /root/webliver/scripts/set-service-key.sh'
echo '  an empty answer with HTTP 502 means the app was still starting: run this script again.'
