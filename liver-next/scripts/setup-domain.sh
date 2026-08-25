#!/usr/bin/env bash
# ============================================================================
#  Put the app on a real domain, with HTTPS.
#
#      bash scripts/setup-domain.sh liverproductions.com
#
#  Run it on the server, as root. It is safe to run twice: every step checks
#  whether it has already been done.
#
#  What it does NOT do is DNS. Pointing the domain at this machine happens at
#  whoever sells you the domain, it takes a few minutes to propagate, and a
#  certificate cannot be issued before it has. The script checks and tells you.
# ============================================================================
set -euo pipefail

domain="${1:-}"
if [ -z "$domain" ]; then
  echo "צריך דומיין:  bash scripts/setup-domain.sh example.com"
  exit 2
fi
domain="$(echo "$domain" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s/^www\.//')"
app_port="${PORT:-3000}"

say() { printf '\n  %s\n' "$*"; }
ok()  { printf '  ok    %s\n' "$*"; }
bad() { printf '  ✗     %s\n' "$*"; }

say "1. האם הדומיין מצביע לכאן?"
here="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '')"
there="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1{print $1}' || echo '')"
[ -n "$here" ] && ok "כתובת השרת: $here" || bad "לא הצלחנו לזהות את כתובת השרת"
if [ -z "$there" ]; then
  bad "$domain לא מצביע לשום מקום עדיין."
  echo
  echo "    צריך ליצור אצל רשם הדומיין שתי רשומות A:"
  echo "        @      A     ${here:-<כתובת השרת>}"
  echo "        www    A     ${here:-<כתובת השרת>}"
  echo
  echo "    זה לוקח בין דקה לשעה. הרץ את הסקריפט שוב אחר כך."
  exit 1
fi
if [ "$there" = "$here" ]; then ok "$domain → $there"; else
  bad "$domain מצביע ל-$there ולא ל-$here. תקן את רשומת ה-A והרץ שוב."
  exit 1
fi

say "2. nginx"
if ! command -v nginx >/dev/null; then
  apt-get update -qq && apt-get install -y -qq nginx
fi
ok "nginx מותקן"

conf=/etc/nginx/sites-available/liver
cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    # Certbot writes its challenge here and then rewrites this file to add
    # the 443 block. Everything else is a plain reverse proxy to the app.
    location / {
        proxy_pass http://127.0.0.1:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # The app reads the host to decide which producer a request is for.
        # Without this it sees 127.0.0.1 and every request is the platform.
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
    }

    # The calendar feed is fetched by Apple and Google on their own schedule
    # and must never be redirected to a sign-in page.
    location /feed/ {
        proxy_pass http://127.0.0.1:${app_port};
        proxy_set_header Host \$host;
    }

    client_max_body_size 12M;
}
NGINX
ln -sf "$conf" /etc/nginx/sites-enabled/liver
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && ok "התצורה תקינה" || { bad "nginx -t נכשל"; nginx -t; exit 1; }
systemctl reload nginx
ok "nginx טעון מחדש"

say "3. תעודת HTTPS"
if ! command -v certbot >/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi
if [ -d "/etc/letsencrypt/live/$domain" ]; then
  ok "כבר יש תעודה ל-$domain"
else
  certbot --nginx -d "$domain" -d "www.$domain" \
    --non-interactive --agree-tos --redirect \
    -m "barakliver@gmail.com" && ok "תעודה הונפקה" || { bad "certbot נכשל"; exit 1; }
fi
systemctl list-timers 2>/dev/null | grep -q certbot && ok "חידוש אוטומטי פעיל" || \
  bad "אין טיימר חידוש. הרץ: systemctl enable --now certbot.timer"

say "4. הכתובת שהאפליקציה מכירה"
env_file="$(dirname "$0")/../.env.local"
if grep -q '^NEXT_PUBLIC_SITE_URL=' "$env_file" 2>/dev/null; then
  sed -i "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=https://${domain}#" "$env_file"
else
  echo "NEXT_PUBLIC_SITE_URL=https://${domain}" >> "$env_file"
fi
ok "NEXT_PUBLIC_SITE_URL=https://${domain}"
echo
echo "    NEXT_PUBLIC_ROOT_DOMAIN נשאר ריק בכוונה."
echo "    הוא מפעיל תת-דומיינים לכל מפיק (keren.${domain}), וזה שלב נפרד"
echo "    שדורש רשומת DNS נוספת: *  A  ${here}"

say "5. בנייה מחדש והפעלה"
( cd "$(dirname "$0")/.." && npm run build ) && systemctl restart liver-next
ok "השירות הופעל מחדש"

say "6. בדיקה מבחוץ"
sleep 2
code="$(curl -fsS -o /dev/null -w '%{http_code}' "https://${domain}/" || echo 000)"
[ "$code" = "200" ] && ok "https://${domain} → 200" || bad "https://${domain} → $code"
feed="$(curl -fsS "https://${domain}/feed/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.ics" 2>/dev/null | head -1 || echo '')"
[ "$feed" = "BEGIN:VCALENDAR" ] && ok "המנוי ליומן עונה כיומן" || bad "המנוי ליומן: $feed"

echo
echo "  נשאר לעשות ידנית:"
echo "    · Supabase → Authentication → URL Configuration"
echo "        Site URL:      https://${domain}"
echo "        Redirect URLs: https://${domain}/auth/callback"
echo "      בלי זה קישורי הכניסה במייל יובילו לכתובת הישנה."
echo "    · Resend → Domains → אימות ${domain}, אחרת רק אתה מקבל מיילים."
