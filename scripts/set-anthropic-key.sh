#!/usr/bin/env bash
# ============================================================================
#  Put the assistant's API key into the environment file, and restart.
#
#      bash /root/webliver/scripts/set-anthropic-key.sh
#
#  The assistant on every screen, the couple's companion, the receipt reader
#  and the meeting summaries all need one key, and without it each of them
#  says so on screen and does nothing. This asks for the key and writes it.
#  Nothing in the command has to be edited, for the same reason set-db-url.sh
#  exists: a placeholder that can be pasted will eventually be pasted.
#
#  It deletes every existing ANTHROPIC_API_KEY line before writing, rather
#  than appending another, because everything that reads this file takes the
#  first match. Then it restarts the app, which reads the file on start, so
#  the assistant is on within a few seconds and no build is needed.
# ============================================================================
set -euo pipefail

ENVFILE="${ENVFILE:-/etc/liver-next.env}"

if [ "$(id -u)" -ne 0 ]; then
  echo "run this as root"; exit 1
fi

if [ ! -f "$ENVFILE" ]; then
  echo "$ENVFILE does not exist. Run deploy-next.sh first; it tells you what goes in it."
  exit 1
fi

cat <<'EOF'

  console.anthropic.com → API keys → Create key.

  Copy the whole key. It starts with sk-ant- and is long. It will not be
  shown as you paste it, because this console gets photographed.

EOF

printf '  paste the key, then Enter: '
IFS= read -rs KEY
echo; echo

# A paste from a web page often carries a space or a newline on either end.
# That is not the key's fault, so it is trimmed rather than refused.
KEY="$(printf '%s' "$KEY" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

# ── is it the thing, or a description of the thing ──────────────────────────
bad=""
case "$KEY" in
  '')                bad="nothing was pasted" ;;
  *…*)               bad="it contains the … from an example" ;;
  *'<'*|*'>'*)       bad="it still has the angle brackets from an example around it" ;;
  *' '*)             bad="it has a space in it, so it is not a key" ;;
  sk-ant-*)          ;;
  *)                 bad="it does not start with sk-ant-" ;;
esac
if [ -z "$bad" ] && [ "${#KEY}" -lt 40 ]; then bad="it is too short to be a key"; fi

if [ -n "$bad" ]; then
  echo "  Not written: $bad."
  [ -n "$KEY" ] && echo "  (what arrived starts with '${KEY:0:3}' and is ${#KEY} characters long)"
  echo "  Nothing in $ENVFILE was changed."
  exit 1
fi

# ── write it, once ──────────────────────────────────────────────────────────
TMP="$(mktemp)"
grep -vE '^ANTHROPIC_API_KEY=' "$ENVFILE" > "$TMP" || true
printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> "$TMP"
cat "$TMP" > "$ENVFILE"
rm -f "$TMP"
chmod 600 "$ENVFILE"

echo "  written to $ENVFILE"

# ── and on ──────────────────────────────────────────────────────────────────
# The service reads the file when it starts, so a restart is all it takes.
if systemctl is-enabled --quiet liver-next 2>/dev/null; then
  systemctl restart liver-next
  echo "  the app restarted. Open the assistant and ask it something."
else
  echo "  the app service is not installed on this machine; the key is written"
  echo "  and the next deploy will pick it up."
fi
