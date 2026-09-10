#!/usr/bin/env bash
# ============================================================================
#  Put the Google Calendar keys into the environment file, and restart.
#
#      bash /root/webliver/scripts/set-google.sh
#
#  The two-way link between the platform's diary and a producer's Google
#  Calendar needs an OAuth client from Google Cloud: a client id and a
#  client secret. Asked for here, the secret hidden as it is pasted, both
#  written once, and the app restarted. Without them the calendar screen
#  says the link is not configured and offers nothing.
#
#  Where they come from, once, in the Google Cloud console:
#    1. console.cloud.google.com → a project (any name).
#    2. APIs & Services → Library → "Google Calendar API" → Enable.
#    3. APIs & Services → OAuth consent screen → External → app name and
#       your email → save. Under "Audience" (or "Publishing status") press
#       PUBLISH APP: a testing app's tokens die after seven days.
#    4. APIs & Services → Credentials → Create credentials → OAuth client ID
#       → Web application. Authorised redirect URI, exactly:
#           https://liverproductions.com/api/google/callback
#       Create. The id ends in .apps.googleusercontent.com; the secret
#       starts with GOCSPX-.
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

trim() { printf '%s' "$1" | tr -d '\r\n' | sed -e 's/^[[:space:]"'"'"']*//' -e 's/[[:space:]"'"'"']*$//'; }

cat <<'EOT'

  Google Cloud → APIs & Services → Credentials → the OAuth client
  (Web application). The client ID ends with .apps.googleusercontent.com.

EOT
printf '  paste the client ID, then Enter: '
IFS= read -r ID
ID="$(trim "$ID")"
case "$ID" in
  '')                              echo "  Not written: nothing was pasted."; exit 1 ;;
  *.apps.googleusercontent.com)    ;;
  *)                               echo "  Not written: a client ID ends with .apps.googleusercontent.com (what arrived starts with '${ID:0:3}' and is ${#ID} characters long)."; exit 1 ;;
esac

cat <<'EOT'

  Now the client secret from the same screen. It starts with GOCSPX- and
  will not be shown as you paste it.

EOT
printf '  paste the client secret, then Enter: '
IFS= read -rs SECRET
echo; echo
SECRET="$(trim "$SECRET")"
case "$SECRET" in
  '')        echo "  Not written: nothing was pasted."; exit 1 ;;
  *' '*)     echo "  Not written: it has a space in it."; exit 1 ;;
  GOCSPX-*)  ;;
  *)         echo "  Not written: a client secret starts with GOCSPX- (what arrived starts with '${SECRET:0:3}' and is ${#SECRET} characters long)."; exit 1 ;;
esac

TMP="$(mktemp)"
grep -vE '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET)=' "$ENVFILE" > "$TMP" || true
printf 'GOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\n' "$ID" "$SECRET" >> "$TMP"
cat "$TMP" > "$ENVFILE"; rm -f "$TMP"; chmod 600 "$ENVFILE"
[ -d "$APP" ] && cp "$ENVFILE" "$APP/.env.local" || true
echo "  written to $ENVFILE"

if systemctl is-enabled --quiet liver-next 2>/dev/null; then
  systemctl restart liver-next
  echo "  the app restarted. Open the calendar screen and press \"connect Google Calendar\"."
fi
