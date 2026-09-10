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

if [ ! -f "$ENVFILE" ]; then
  echo "$ENVFILE does not exist. Run deploy-next.sh first."
  exit 1
fi

has() { grep -qE "^$1=.+" "$ENVFILE"; }

echo
echo "  secrets in $ENVFILE (names only):"
echo
for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_URL \
         ANTHROPIC_API_KEY RESEND_API_KEY MAIL_FROM CRON_KEY; do
  if has "$v"; then printf '    %-32s present\n' "$v"; else printf '    %-32s MISSING\n' "$v"; fi
done

echo
echo "  what each missing one switches off, and the script that writes it:"
echo
has SUPABASE_SERVICE_ROLE_KEY || echo "    SUPABASE_SERVICE_ROLE_KEY: the nightly sweep and both weekly letters.  bash /root/webliver/scripts/set-service-key.sh"
has ANTHROPIC_API_KEY         || echo "    ANTHROPIC_API_KEY: every assistant and the receipt reader.             bash /root/webliver/scripts/set-anthropic-key.sh"
has RESEND_API_KEY            || echo "    RESEND_API_KEY / MAIL_FROM: every email the platform sends.           bash /root/webliver/scripts/set-mail.sh"
has MAIL_FROM                 || true
has CRON_KEY                  || echo "    CRON_KEY: the nightly sweep cannot be called.                          bash /root/webliver/scripts/set-cron-key.sh"

echo
if crontab -l 2>/dev/null | grep -q '/api/cron'; then
  echo "  crontab: the sweep is scheduled"
  crontab -l 2>/dev/null | grep '/api/cron' | sed 's/x-cron-key: [^"]*/x-cron-key: (hidden)/' | sed 's/^/    /'
else
  echo "  crontab: the sweep is NOT scheduled.  bash /root/webliver/scripts/set-cron-key.sh"
fi
echo
