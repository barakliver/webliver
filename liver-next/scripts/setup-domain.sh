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
#
#  It also refuses to take a live site down. There is already something serving
#  liverproductions.com on this machine, and an earlier version of this script
#  would have replaced its nginx config and reloaded, with the first sign of
#  trouble being a visitor. Now it backs up anything it finds and stops, and
#  --force is the only way past.
#
#  For trying the new app while the old one keeps serving, give it a subdomain:
#
#      bash scripts/setup-domain.sh app.liverproductions.com
#
#  That adds a server block and touches nothing else.
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

# A subdomain gets no www alias; an apex does.
alias_www=1
[ "$(echo "$domain" | tr -cd '.' | wc -c)" -gt 1 ] && alias_www=0

say() { printf '\n  %s\n' "$*"; }
ok()  { printf '  ok    %s\n' "$*"; }
bad() { printf '  ✗     %s\n' "$*"; }

say "1. האם הדומיין מצביע לכאן?"
# Asked of the outside world first, because a machine behind NAT does not know
# its own public address; the local route is the fallback when the network is
# locked down, and an unknown address is a warning rather than a stop.
here="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null \
     || curl -fsS --max-time 8 https://ifconfig.me 2>/dev/null \
     || ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' \
     || echo '')"
there="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1{print $1}' || echo '')"
[ -n "$here" ] && ok "כתובת השרת: $here" || bad "לא הצלחנו לזהות את כתובת השרת. ממשיכים בלי ההשוואה." 
if [ -z "$there" ]; then
  bad "$domain לא מצביע לשום מקום עדיין."
  echo
  if [ "$alias_www" -eq 1 ]; then
    echo "    צריך ליצור אצל רשם הדומיין שתי רשומות A:"
    echo "        @      A     ${here:-<כתובת השרת>}"
    echo "        www    A     ${here:-<כתובת השרת>}"
  else
    echo "    צריך ליצור אצל רשם הדומיין רשומה אחת:"
    echo "        ${domain%%.*}    A     ${here:-<כתובת השרת>}"
    echo "    זו תוספת. היא לא נוגעת באתר שכבר חי על הדומיין הראשי."
  fi
  echo
  echo "    זה לוקח בין דקה לשעה. הרץ את הסקריפט שוב אחר כך."
  exit 1
fi
if [ -z "$here" ]; then
  ok "$domain → $there  (לא השווינו, כי לא ידועה כתובת השרת)"
elif [ "$there" = "$here" ]; then
  ok "$domain → $there"
else
  bad "$domain מצביע ל-$there ולא ל-$here. תקן את רשומת ה-A והרץ שוב."
  exit 1
fi

say "2. האם משהו כבר מוגש מהכתובת הזו?"
existing="$(grep -rlE "server_name[^;]*(^|[[:space:]])${domain//./\\.}([[:space:]]|;)" \
  /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -v '/liver$' || true)"
if [ -n "$existing" ]; then
  bad "כבר יש תצורת nginx שמגישה את $domain:"
  echo "$existing" | sed 's/^/        /'
  if [ "$force" -eq 0 ]; then
    echo
    echo "    זה ככל הנראה האתר הישן, והוא חי כרגע."
    echo "    כדי לנסות את החדש בלי לגעת בו, תן תת-דומיין:"
    echo "        bash scripts/setup-domain.sh app.${domain}"
    echo "    (וצור קודם רשומה:  app  A  ${here:-<כתובת השרת>})"
    echo
    echo "    אם אתה באמת רוצה להחליף את האתר הישן:"
    echo "        bash scripts/setup-domain.sh ${domain} --force"
    exit 1
  fi
  # Replacing a live site. The config is copied, the old symlinks are recorded
  # so the restore is one command, and a script is written next to the backup
  # so getting back does not depend on anybody remembering how.
  stamp="$(date +%Y%m%d-%H%M%S)"
  backup="/root/nginx-backup-${stamp}"
  mkdir -p "$backup"
  : > "$backup/enabled.list"
  echo "$existing" | while read -r f; do
    [ -n "$f" ] || continue
    cp -aL "$f" "$backup/$(basename "$f")"
    echo "$f" >> "$backup/enabled.list"
  done

  cat > "$backup/restore.sh" <<RESTORE
#!/usr/bin/env bash
# Puts the previous site back exactly as it was. Run as root.
set -euo pipefail
while read -r target; do
  [ -n "\$target" ] || continue
  cp -a "$backup/\$(basename "\$target")" "\$target"
  echo "  שוחזר: \$target"
done < "$backup/enabled.list"
rm -f "/etc/nginx/sites-enabled/liver-${domain}"
nginx -t && systemctl reload nginx
echo "  האתר הישן חזר."
RESTORE
  chmod +x "$backup/restore.sh"

  ok "גיבוי נשמר ב-$backup"
  echo "        חזרה לאתר הישן בפקודה אחת:"
  echo "            bash $backup/restore.sh"
  echo
  echo "    שים לב: הקבצים של האתר הישן לא נמחקים, רק מפסיקים להיות מוגשים."
  echo "    כתובות ישנות שהיו מסומנות אצל מבקרים יחזירו 404 מהאפליקציה החדשה."

  # Disable rather than delete: the file stays where it was, so the restore is
  # a copy back rather than a rebuild from memory.
  echo "$existing" | while read -r f; do
    [ -n "$f" ] || continue
    case "$f" in /etc/nginx/sites-enabled/*) rm -f "$f" ;; *) mv "$f" "$f.disabled-${stamp}" ;; esac
  done
  ok "האתר הישן הופסק"
fi

say "3. nginx"
if ! command -v nginx >/dev/null; then
  apt-get update -qq && apt-get install -y -qq nginx
fi
ok "nginx מותקן"

www_names=""
[ "$alias_www" -eq 1 ] && www_names=" www.${domain}"

conf="/etc/nginx/sites-available/liver-${domain}"
cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${domain}${www_names};

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
ln -sf "$conf" "/etc/nginx/sites-enabled/liver-${domain}"
# The stock default only ever shadows a real site, and only if nothing else is
# already answering. Left alone when something is.
[ -z "$existing" ] && rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && ok "התצורה תקינה" || { bad "nginx -t נכשל"; nginx -t; exit 1; }
systemctl reload nginx
ok "nginx טעון מחדש"

say "4. תעודת HTTPS"
if ! command -v certbot >/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi
if [ -d "/etc/letsencrypt/live/$domain" ]; then
  ok "כבר יש תעודה ל-$domain"
else
  certbot_domains=(-d "$domain")
  [ "$alias_www" -eq 1 ] && certbot_domains+=(-d "www.$domain")
  certbot --nginx "${certbot_domains[@]}" \
    --non-interactive --agree-tos --redirect \
    -m "barakliver@gmail.com" && ok "תעודה הונפקה" || { bad "certbot נכשל"; exit 1; }
fi
systemctl list-timers 2>/dev/null | grep -q certbot && ok "חידוש אוטומטי פעיל" || \
  bad "אין טיימר חידוש. הרץ: systemctl enable --now certbot.timer"

say "5. הכתובת שהאפליקציה מכירה"
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

say "6. בנייה מחדש והפעלה"
( cd "$(dirname "$0")/.." && npm run build ) && systemctl restart liver-next
ok "השירות הופעל מחדש"

say "7. בדיקה מבחוץ"
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
