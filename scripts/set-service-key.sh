#!/usr/bin/env bash
# ============================================================================
#  Put the Supabase service role key into the environment file, and restart.
#
#      bash /root/webliver/scripts/set-service-key.sh
#
#  The nightly sweep and the weekly letters read every producer's rows, which
#  a browser session may not; they use this key, and without it the sweep
#  answers "not configured" and does nothing. Asked for here, hidden as it is
#  pasted, written once, and the app restarted.
#
#  This key bypasses every row policy. It belongs in this file and nowhere
#  else: not in a chat, not in a screenshot.
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

cat <<'EOF'

  Supabase → Project Settings → API Keys. The page has two tabs:

    "API Keys"    → Secret keys → the key that starts with  sb_secret_
                    (press Reveal or Copy; create one if the list is empty)
    "Legacy"      → service_role → the long key that starts with  eyJ

  Either one works. Not the publishable / anon key, not the project URL,
  and not the JWT secret. It will not be shown as you paste it.

EOF

printf '  paste the service role key, then Enter: '
IFS= read -rs KEY
echo; echo
KEY="$(printf '%s' "$KEY" | tr -d '\r\n' | sed -e 's/^[[:space:]"'"'"']*//' -e 's/[[:space:]"'"'"']*$//')"

bad=""
case "$KEY" in
  '')               bad="nothing was pasted" ;;
  *…*)              bad="it contains the … from an example" ;;
  *'<'*|*'>'*)      bad="it still has the angle brackets from an example around it" ;;
  *' '*)            bad="it has a space in it, so it is not a key" ;;
  eyJ*|sb_secret_*) ;;
  sb_publishable_*) bad="that is the publishable key, which the browser already has; the secret one is in the Secret keys list, and starts with sb_secret_" ;;
  http*)            bad="that is the project URL, not a key" ;;
  *)                bad="it does not look like a service key: those start with sb_secret_ (API Keys tab) or eyJ (Legacy tab). The JWT secret on the same page is something else and is not wanted here" ;;
esac
if [ -z "$bad" ] && [ "${#KEY}" -lt 40 ]; then bad="it is too short to be a key"; fi
if [ -n "$bad" ]; then
  echo "  Not written: $bad."
  echo "  Nothing in $ENVFILE was changed."
  exit 1
fi

TMP="$(mktemp)"
grep -vE '^SUPABASE_SERVICE_ROLE_KEY=' "$ENVFILE" > "$TMP" || true
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" >> "$TMP"
cat "$TMP" > "$ENVFILE"; rm -f "$TMP"; chmod 600 "$ENVFILE"
[ -d "$APP" ] && cp "$ENVFILE" "$APP/.env.local" || true
echo "  written to $ENVFILE"

if systemctl is-enabled --quiet liver-next 2>/dev/null; then
  systemctl restart liver-next
  echo "  the app restarted. Now: bash /root/webliver/scripts/set-cron-key.sh"
fi
