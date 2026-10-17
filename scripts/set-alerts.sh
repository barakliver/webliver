#!/usr/bin/env bash
# ============================================================================
#  The keys the enquiry engine and the inbox need, asked for and written.
#
#      bash /root/webliver/scripts/set-alerts.sh
#
#  Nothing here is pasted into a chat. The VAPID pair for phone
#  notifications is generated on this machine and written straight to the
#  environment file; the provider tokens (WhatsApp in, mail in) are typed
#  at a prompt that does not echo, and each one is optional: press Enter to
#  leave it as it is. Safe to run again; it replaces only its own lines.
#
#  What each key opens is in liver-next/DEPLOY.md under "מנוע הלידים".
# ============================================================================
set -euo pipefail

ENVFILE="${ENVFILE:-/etc/liver-next.env}"
APP="${APP:-/root/webliver/liver-next}"

if [ "$(id -u)" -ne 0 ]; then
  echo "run this as root"; exit 1
fi
if [ ! -f "$ENVFILE" ]; then
  echo "$ENVFILE does not exist. Run deploy-next.sh first."; exit 1
fi

# Replace one NAME=value line, or add it. Never prints the value.
put() {
  local name="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -vE "^${name}=" "$ENVFILE" > "$tmp" || true
  printf '%s=%s\n' "$name" "$value" >> "$tmp"
  cat "$tmp" > "$ENVFILE"; rm -f "$tmp"; chmod 600 "$ENVFILE"
}
has() { grep -qE "^$1=.+" "$ENVFILE"; }

# ── phone notifications: a key pair made here ───────────────────────────────
if has VAPID_PUBLIC_KEY && has VAPID_PRIVATE_KEY; then
  echo "  VAPID keys already in $ENVFILE; keeping them (phones that said yes stay subscribed)"
else
  if [ ! -d "$APP/node_modules/web-push" ]; then
    echo "  web-push is not installed under $APP yet; deploy 2.6 first, then run this again"; exit 1
  fi
  PAIR="$(cd "$APP" && node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)")"
  put VAPID_PUBLIC_KEY "${PAIR%% *}"
  put VAPID_PRIVATE_KEY "${PAIR##* }"
  has VAPID_SUBJECT || put VAPID_SUBJECT "mailto:barakliver@gmail.com"
  echo "  a VAPID key pair was written to $ENVFILE"
fi

# ── the optional ones, typed without echo ───────────────────────────────────
ask() {
  local name="$1" what="$2" value
  if has "$name"; then
    printf '  %s is already set. New value, or Enter to keep it: ' "$what"
  else
    printf '  %s (Enter to skip): ' "$what"
  fi
  read -rs value; echo
  if [ -n "$value" ]; then put "$name" "$value"; echo "    written"; fi
}
echo
echo "  Optional. Each one opens one door; see DEPLOY.md."
ask TWILIO_AUTH_TOKEN        "Twilio auth token (WhatsApp in through Twilio)"
ask TWILIO_ACCOUNT_SID       "Twilio account SID"
ask GREEN_API_WEBHOOK_TOKEN  "Green API webhook token (WhatsApp in through Green API)"
ask RESEND_WEBHOOK_SECRET    "Resend webhook signing secret, whsec_... (mail in)"

# ── the running app reads the file on start ─────────────────────────────────
[ -d "$APP" ] && cp "$ENVFILE" "$APP/.env.local" || true
if systemctl is-enabled --quiet liver-next 2>/dev/null; then
  systemctl restart liver-next
  echo "  the app restarted with them"
fi

echo
echo "  names only, never values:"
bash "$(dirname "$0")/check-env.sh" 2>/dev/null | grep -E 'VAPID|TWILIO|GREEN|RESEND_WEBHOOK' || true
