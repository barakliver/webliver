#!/usr/bin/env bash
# ============================================================================
#  Put the mail sender into the environment file, and restart.
#
#      bash /root/webliver/scripts/set-mail.sh
#
#  Every email the platform sends (the couple's invitation, the enquiry
#  confirmations, the Sunday budget letter, the Monday supplier letter, the
#  agent's failure notice) goes through Resend, and needs two things: the
#  API key, and the address the letters come from. Asked for here, the key
#  hidden as it is pasted, both written once, and the app restarted.
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

  resend.com → API Keys → Create API Key → Add.

  Resend shows the key ONCE, in the box that opens right after Add; the
  list afterwards only shows its name and re_... with dots. If that moment
  has passed, create a new key: it costs nothing. The key starts with re_
  and is about 36 characters. It will not be shown as you paste it.

EOF
printf '  paste the Resend key, then Enter: '
IFS= read -rs KEY
echo; echo
KEY="$(printf '%s' "$KEY" | tr -d '\r\n' | sed -e 's/^[[:space:]"'"'"']*//' -e 's/[[:space:]"'"'"']*$//')"

bad=""
case "$KEY" in
  '')           bad="nothing was pasted" ;;
  *…*)          bad="it contains the … from an example" ;;
  *'<'*|*'>'*)  bad="it still has the angle brackets from an example around it" ;;
  *' '*)        bad="it has a space in it, so it is not a key" ;;
  re_*'.'*)     bad="that is the masked key from the list (re_ with dots); the real one is only shown once, right after Add. Create a new key and paste it from that box" ;;
  re_*)         ;;
  whsec_*)      bad="that is a webhook signing secret, not an API key" ;;
  *)            bad="it does not start with re_, so it is not a Resend API key (Create API Key → Add, and copy from the box that opens)" ;;
esac
if [ -z "$bad" ] && [ "${#KEY}" -lt 20 ]; then bad="it is too short to be a key"; fi
if [ -n "$bad" ]; then
  echo "  Not written: $bad."; echo "  Nothing in $ENVFILE was changed."; exit 1
fi

cat <<'EOF'

  Now the address the letters come from. It has to be on a domain verified
  in Resend, in this shape:   Liver Productions <hello@liverproductions.com>

EOF
printf '  type the from address, then Enter: '
IFS= read -r FROM
FROM="$(printf '%s' "$FROM" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
case "$FROM" in
  *@*.*) ;;
  *) echo "  Not written: that is not an email address."; echo "  Nothing in $ENVFILE was changed."; exit 1 ;;
esac

TMP="$(mktemp)"
grep -vE '^(RESEND_API_KEY|MAIL_FROM)=' "$ENVFILE" > "$TMP" || true
printf 'RESEND_API_KEY=%s\nMAIL_FROM=%s\n' "$KEY" "$FROM" >> "$TMP"
cat "$TMP" > "$ENVFILE"; rm -f "$TMP"; chmod 600 "$ENVFILE"
[ -d "$APP" ] && cp "$ENVFILE" "$APP/.env.local" || true
echo "  written to $ENVFILE"

if systemctl is-enabled --quiet liver-next 2>/dev/null; then
  systemctl restart liver-next
  echo "  the app restarted. Emails go out from now on."
fi
