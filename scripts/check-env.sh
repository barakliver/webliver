#!/usr/bin/env bash
# ============================================================================
#  Which secrets the server has, by name only.
#
#      bash /root/webliver/scripts/check-env.sh
#
#  Prints "present" or "MISSING" beside each variable the platform needs, and
#  whether the nightly sweep is in the crontab. It never prints a value: this
#  console gets photographed, and a key that reaches a chat has to be reset.
# ============================================================================
set -euo pipefail

ENVFILE="${ENVFILE:-/etc/liver-next.env}"
APP="${APP:-/root/webliver/liver-next}"
NAMES="NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_URL \
       ANTHROPIC_API_KEY RESEND_API_KEY MAIL_FROM CRON_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET"

if [ ! -f "$ENVFILE" ]; then
  echo "$ENVFILE does not exist. Run deploy-next.sh first."
  exit 1
fi

has() { grep -qE "^$1=.+" "$ENVFILE"; }

# Three places a value can live, and they can disagree: the environment file
# the service reads on start, the checkout's copy of it that a hand-run and
# `next start` also read, and what the running process actually got. A key
# that works on screen but shows MISSING here is in one of the other two.
# Names only, from all three: /proc/<pid>/environ is read for its keys.
LOCAL="$APP/.env.local"
PID="$(systemctl show -p MainPID --value liver-next 2>/dev/null || true)"
PROC=""
if [ -n "$PID" ] && [ "$PID" != "0" ] && [ -r "/proc/$PID/environ" ]; then
  PROC="$(tr '\0' '\n' < "/proc/$PID/environ" | grep -E '^[A-Z_]+=.+' | cut -d= -f1 || true)"
fi
in_local() { [ -f "$LOCAL" ] && grep -qE "^$1=.+" "$LOCAL"; }
in_proc()  { [ -n "$PROC" ] && printf '%s\n' "$PROC" | grep -qx "$1"; }
mark()     { if "$@"; then printf 'present'; else printf 'MISSING'; fi; }

echo
echo "  secrets by name, in the three places they can be:"
echo
printf '    %-32s %-10s %-10s %s\n' "" "env file" ".env.local" "running app"
for v in $NAMES; do
  if [ -n "$PROC" ]; then p="$(mark in_proc "$v")"; else p="(app not running)"; fi
  printf '    %-32s %-10s %-10s %s\n' "$v" "$(mark has "$v")" "$(mark in_local "$v")" "$p"
done
echo
echo "  env file = $ENVFILE, what the service reads when it starts."
echo "  a value present in the app but MISSING in the env file was put somewhere"
echo "  else and will be lost on the next deploy: run the script that writes it."

echo
echo "  what each missing one switches off, and the script that writes it:"
echo
has SUPABASE_SERVICE_ROLE_KEY || echo "    SUPABASE_SERVICE_ROLE_KEY: the nightly sweep and both weekly letters.  bash /root/webliver/scripts/set-service-key.sh"
has ANTHROPIC_API_KEY         || echo "    ANTHROPIC_API_KEY: every assistant and the receipt reader.             bash /root/webliver/scripts/set-anthropic-key.sh"
has RESEND_API_KEY            || echo "    RESEND_API_KEY / MAIL_FROM: every email the platform sends.           bash /root/webliver/scripts/set-mail.sh"
has MAIL_FROM                 || true
has CRON_KEY                  || echo "    CRON_KEY: the nightly sweep cannot be called.                          bash /root/webliver/scripts/set-cron-key.sh"
has GOOGLE_CLIENT_ID          || echo "    GOOGLE_CLIENT_ID / _SECRET: the Google Calendar link.                  bash /root/webliver/scripts/set-google.sh"
has GOOGLE_CLIENT_SECRET      || true

echo
if crontab -l 2>/dev/null | grep -q '/api/cron'; then
  echo "  crontab: the sweep is scheduled"
  crontab -l 2>/dev/null | grep '/api/cron' | sed 's/x-cron-key: [^"]*/x-cron-key: (hidden)/' | sed 's/^/    /'
else
  echo "  crontab: the sweep is NOT scheduled.  bash /root/webliver/scripts/set-cron-key.sh"
fi
echo
