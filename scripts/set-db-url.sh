#!/usr/bin/env bash
# ============================================================================
#  Put the database connection string into the environment file.
#
#      bash /root/webliver/scripts/set-db-url.sh
#
#  It asks for the string and writes it. Nothing in the command has to be
#  edited, which is the entire point of it existing.
#
#  The instruction it replaces was a printf with a placeholder in angle
#  brackets to be swapped for the real value. That instruction was followed
#  literally twice, by two different readers, and both times the placeholder
#  itself ended up in the file — once as "…" and once as the Hebrew words
#  describing what should have gone there. A placeholder that can be pasted
#  will eventually be pasted. So there is no longer one.
#
#  It also deletes every existing DATABASE_URL line before writing, rather
#  than appending another. Appending is what produced a file with two of them,
#  and everything that reads this file takes the first match — so a corrected
#  line added underneath a broken one changes nothing at all, and the error
#  message stays exactly the same however many times it is fixed.
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

  Supabase → Project Settings → Database → Connection string.

  Take the SESSION POOLER one, on port 5432. Not 6543: that is the
  transaction pooler, it does not carry the statements pg_dump needs, and the
  backup is the whole reason this is being asked for.

  Replace [YOUR-PASSWORD] in it with the real password, and paste the WHOLE
  line. Not the password on its own — the whole thing, which looks like:

      postgresql://postgres.abcdefgh:THEPASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

EOF

printf '  paste the whole connection string, then Enter:\n  '
IFS= read -r URI
echo

# ── is it the thing, or a description of the thing ──────────────────────────
# Every one of these has actually been written into this file by somebody
# following instructions. They are not hypothetical.
bad=""
case "$URI" in
  '')                    bad="nothing was pasted" ;;
  *…*)                   bad="it contains the … from an example" ;;
  *'[YOUR-PASSWORD]'*)   bad="the [YOUR-PASSWORD] placeholder is still in it" ;;
  *PASTE_THE_WHOLE_URI*) bad="it is the placeholder rather than the value" ;;
  *'<'*|*'>'*)           bad="it still has the angle brackets from an example around it" ;;
  postgresql://*|postgres://*) ;;
  *'://'*)               bad="it does not start with postgresql://" ;;
  # No scheme and no host: this is the password by itself. It is the likeliest
  # wrong thing to type at a prompt that has just finished talking about the
  # password, and saying "it does not start with postgresql://" to somebody who
  # pasted a password is a true sentence that explains nothing.
  *)                     bad="that looks like the password on its own, not the whole string" ;;
esac

if [ -n "$bad" ]; then
  echo "  Not written: $bad."
  case "$bad" in
    *'on its own'*)
      echo
      echo "  The whole line is wanted, with the password already inside it:"
      echo
      echo "      postgresql://postgres.xxxx:THEPASSWORD@aws-0-...pooler.supabase.com:5432/postgres"
      echo
      echo "  Supabase → the Connect button at the top → Session pooler."
      echo
      echo "  And since a password typed on its own at a prompt tends to end up"
      echo "  somewhere it should not — a screenshot, a scrollback, a support"
      echo "  thread — reset it before using it: Database settings → Reset"
      echo "  database password → Generate a password."
      ;;
  esac
  echo "  Nothing in $ENVFILE was changed. Run this again with the real string."
  exit 1
fi

case "$URI" in
  *:6543/*) echo "  Warning: that is port 6543, the transaction pooler. pg_dump will fail on it."
            echo "  Take the session pooler string on 5432 and run this again."
            exit 1 ;;
esac

# ── a password with punctuation in it ───────────────────────────────────────
# The password lives inside a URI, so @ / : ? # % in it are not characters,
# they are syntax. An @ in the password gives the string two of them and the
# host is then read from the wrong side of the last one: it connects to
# nothing, or to something unexpected, with an error that says nothing about
# the password. Nobody guesses this from the message.
#
# Not repaired automatically. Percent-encoding somebody's password on their
# behalf and being wrong about it is a worse failure than refusing, and the
# real fix is thirty seconds long: reset the password and let Supabase
# generate one, which is letters and digits only.
if [ "$(printf '%s' "$URI" | tr -cd '@' | wc -c)" -gt 1 ]; then
  echo "  Not written: there is more than one @ in that string, which almost"
  echo "  always means the password itself contains one. Inside a URI that is"
  echo "  syntax rather than a character, and the host is then read from the"
  echo "  wrong place."
  echo
  echo "  Supabase → Project Settings → Database → Reset database password,"
  echo "  and press Generate a password. Those are letters and digits only."
  exit 1
fi

case "$URI" in
  *' '*) echo "  Not written: there is a space in that string, so part of it is missing"
         echo "  or something extra came along with the paste."
         exit 1 ;;
esac

# One line, not two. Every reader of this file takes the first match.
sed -i '/^DATABASE_URL=/d' "$ENVFILE"
printf '\nDATABASE_URL=%s\n' "$URI" >> "$ENVFILE"
chmod 600 "$ENVFILE"

N="$(grep -c '^DATABASE_URL=' "$ENVFILE" || true)"
# The host and nothing else, so the line can be confirmed by eye without the
# password going into the scrollback of a browser-based console.
HOST="$(printf '%s' "$URI" | sed -e 's|^[a-z]*://||' -e 's|^[^@]*@||' -e 's|/.*$||')"

echo "  written: $N line, host $HOST"
echo
echo "  now:  bash /root/webliver/scripts/install-agent.sh"
