#!/usr/bin/env bash
# ============================================================================
#  Put the app on a real domain, with HTTPS.
#
#      bash scripts/setup-domain.sh liverproductions.com
#
#  Run it on the server, as root. Safe to run twice: every step checks whether
#  it has already been done.
#
#  It detects the web server rather than assuming one. This machine turned out
#  to be running Caddy, which holds 80 and 443 and manages its own
#  certificates, so the first version of this script installing nginx and
#  reaching for certbot was solving a problem that did not exist and creating
#  one that did.
#
#  What it does NOT do is DNS. That happens at whoever sells you the domain.
# ============================================================================
set -euo pipefail

domain="${1:-}"
if [ -z "$domain" ]; then
  echo "צריך דומיין:  bash scripts/setup-domain.sh example.com"
  exit 2
fi
force=0
[ "${2:-}" = "--force" ] && force=1
domain="$(echo "$domain" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s/^www\.//')"
app_port="${PORT:-3000}"

alias_www=1
[ "$(echo "$domain" | tr -cd '.' | wc -c)" -gt 1 ] && alias_www=0

say() { printf '\n  %s\n' "$*"; }
ok()  { printf '  ok    %s\n' "$*"; }
bad() { printf '  ✗     %s\n' "$*"; }

# ── 1. DNS ──────────────────────────────────────────────────────────────────
say "1. האם הדומיין מצביע לכאן?"
here="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null \
     || curl -fsS --max-time 8 https://ifconfig.me 2>/dev/null \
     || ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' \
     || echo '')"
there="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1{print $1}' || echo '')"
[ -n "$here" ] && ok "כתובת השרת: $here" || bad "לא זוהתה כתובת השרת. ממשיכים בלי ההשוואה."

if [ -z "$there" ]; then
  bad "$domain לא מצביע לשום מקום."
  if [ "$alias_www" -eq 1 ]; then
    echo "        @      A     ${here:-<כתובת השרת>}"
    echo "        www    A     ${here:-<כתובת השרת>}"
  else
    echo "        ${domain%%.*}    A     ${here:-<כתובת השרת>}"
  fi
  exit 1
fi
if [ -z "$here" ] || [ "$there" = "$here" ]; then ok "$domain → $there"; else
  bad "$domain מצביע ל-$there ולא ל-$here."
  exit 1
fi

# ── 2. which web server ─────────────────────────────────────────────────────
say "2. מי מגיש את פורט 80"
holder="$(ss -tlnpH 'sport = :80' 2>/dev/null | grep -oE 'users:\(\("[^"]+' | grep -oE '[^"]+$' | sort -u | head -1)"
if [ -z "$holder" ]; then
  bad "אף אחד לא מאזין על פורט 80."
  echo "    אם התכוונת להתקין שרת אינטרנט, תגיד לי ואוסיף את השלב."
  exit 1
fi
ok "פורט 80: $holder"

case "$holder" in
  caddy) : ;;
  *)
    bad "הסקריפט יודע לעבוד עם Caddy. כאן רץ $holder."
    echo "    תגיד לי מה זה ואוסיף לו תמיכה, במקום לנחש ולהפיל אתר חי."
    exit 1
    ;;
esac

# ── 3. the Caddyfile ────────────────────────────────────────────────────────
say "3. התצורה של Caddy"
cf=/etc/caddy/Caddyfile
[ -f "$cf" ] || { bad "לא נמצא $cf"; exit 1; }

if grep -qE "^[[:space:]]*#?[[:space:]]*liver-next managed" "$cf"; then
  ok "כבר מנוהל על ידי הסקריפט הזה"
elif grep -qE "(^|[[:space:],])${domain//./\\.}([[:space:],{]|$)" "$cf"; then
  bad "$cf כבר מגיש את $domain:"
  grep -nE "(^|[[:space:],])${domain//./\\.}([[:space:],{]|$)" "$cf" | sed 's/^/        /'
  if [ "$force" -eq 0 ]; then
    echo
    echo "    זה האתר הישן. כדי להחליף אותו:"
    echo "        bash \$0 ${domain} --force"
    echo "    כדי לנסות את החדש לצידו, תן תת-דומיין:"
    echo "        bash \$0 app.${domain}"
    exit 1
  fi
fi

stamp="$(date +%Y%m%d-%H%M%S)"
backup="/root/caddy-backup-${stamp}"
mkdir -p "$backup"
cp -a "$cf" "$backup/Caddyfile"
cat > "$backup/restore.sh" <<RESTORE
#!/usr/bin/env bash
# מחזיר את התצורה שהייתה לפני ההחלפה. הרץ כ-root.
set -euo pipefail
cp -a "$backup/Caddyfile" "$cf"
caddy validate --config "$cf" >/dev/null 2>&1 || caddy fmt --overwrite "$cf" || true
systemctl reload caddy
echo "  התצורה הישנה חזרה."
RESTORE
chmod +x "$backup/restore.sh"
ok "גיבוי: $backup/Caddyfile"
echo "        חזרה בפקודה אחת:  bash $backup/restore.sh"

# Everything this script owns lives between two markers, so running it again
# replaces its own block and never touches anything somebody added by hand.
www_line=""
[ "$alias_www" -eq 1 ] && www_line=", www.${domain}"

www_flag=""
[ "$alias_www" -eq 1 ] && www_flag="--www"
python3 "$(dirname "$0")/caddy-site.py" "$cf" "$domain" "$app_port" $www_flag

ok "התצורה נכתבה"

if caddy validate --config "$cf" >/dev/null 2>&1; then
  ok "התצורה תקינה"
else
  bad "caddy validate נכשל. מחזיר את הישנה."
  cp -a "$backup/Caddyfile" "$cf"
  caddy validate --config "$cf" >/dev/null 2>&1 || true
  systemctl reload caddy || true
  caddy validate --config "$cf" 2>&1 | head -20
  exit 1
fi

systemctl reload caddy && ok "Caddy טעון מחדש"

# ── 4. the address the app answers with ─────────────────────────────────────
say "4. הכתובת שהאפליקציה מכירה"
env_file="$(cd "$(dirname "$0")/.." && pwd)/.env.local"
if grep -q '^NEXT_PUBLIC_SITE_URL=' "$env_file" 2>/dev/null; then
  sed -i "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=https://${domain}#" "$env_file"
else
  echo "NEXT_PUBLIC_SITE_URL=https://${domain}" >> "$env_file"
fi
ok "NEXT_PUBLIC_SITE_URL=https://${domain}"
echo "        NEXT_PUBLIC_ROOT_DOMAIN נשאר ריק. הוא מפעיל תת-דומיין לכל מפיק,"
echo "        וזה שלב נפרד שדורש רשומה:  *  A  ${here}"

# ── 5. rebuild and restart ──────────────────────────────────────────────────
say "5. בנייה מחדש והפעלה"
( cd "$(dirname "$0")/.." && npm run build ) >/dev/null && systemctl restart liver-next
ok "השירות הופעל מחדש"

# ── 6. check from outside ───────────────────────────────────────────────────
say "6. בדיקה מבחוץ"
sleep 3
code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "https://${domain}/" || echo 000)"
[ "$code" = "200" ] && ok "https://${domain} → 200" || bad "https://${domain} → $code"
feed="$(curl -fsS --max-time 20 "https://${domain}/feed/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.ics" 2>/dev/null | head -1 || echo '')"
[ "$feed" = "BEGIN:VCALENDAR" ] && ok "המנוי ליומן עונה כיומן" || bad "המנוי ליומן: ${feed:-אין תשובה}"

echo
echo "  נשאר לעשות ידנית:"
echo "    · Supabase → Authentication → URL Configuration"
echo "        Site URL:      https://${domain}"
echo "        Redirect URLs: https://${domain}/auth/callback"
echo "    · Resend → Domains → אימות ${domain}, אחרת רק אתה מקבל מיילים."
