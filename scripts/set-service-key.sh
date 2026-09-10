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

  Supabase → Project Settings → API keys → service_role (secret).

  Copy the whole key. It will not be shown as you paste it.

EOF

printf '  paste the service role key, then Enter: '
IFS= read -rs KEY
echo; echo
KEY="$(printf '%s' "$KEY" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

bad=""
case "$KEY" in
  '')            bad="nothing was pasted" ;;
  *…*)           bad="it contains the … from an example" ;;
  *'<'*|*'>'*)   bad="it still has the angle brackets from an example around it" ;;
  *' '*)         bad="it has a space in it, so it is not a key" ;;
  eyJ*|sb_secret_*) ;;
  *)             bad="it does not look like a Supabase key (they start with eyJ or sb_secret_)" ;;
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
