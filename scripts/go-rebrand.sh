#!/usr/bin/env bash
# ============================================================================
#  Move the business onto beforeidoevent.com
# ============================================================================
#  Run on the droplet, as root, as many times as it takes:
#
#      bash /root/webliver/scripts/go-rebrand.sh            # do what can be done
#      bash /root/webliver/scripts/go-rebrand.sh --status   # only look
#
#  The shape it builds is the one in REBRAND.md:
#
#      beforeidoevent.co.il   ─301─┐
#      beforeidoevents.co.il  ─301─┼──→  beforeidoevent.com        the business
#      liverproductions.com   ─301─┘           │
#                                              ├──→  app.beforeidoevent.com   the platform
#                                              └──→  beforeido.co.il          the game
#
#  beforeido.co.il is not touched, here or anywhere in this script: it is the
#  game's own site, on its own host with its own DNS, and the business only
#  links to it.
#
#  It works in two phases because the two have different risks.
#
#  Phase 1 only adds. The new names are written beside whatever already serves
#  the old ones, so no address is claimed twice and nothing that works today
#  stops. It waits until the new names really answer over HTTPS.
#
#  Phase 2 is the cutover, and it does not start until phase 1 has been seen to
#  work from outside and somebody has said the two dashboard settings are done.
#  It changes the three addresses the app is built from, rebuilds, and turns the
#  old names into redirects - all of them except /api/* and /feed/*, which keep
#  answering for real, because those are addresses other people pasted into
#  consoles this business cannot see inside (REBRAND.md, "the two things that
#  cost real money").
#
#  Every Caddy change is validated before it is loaded and put back if it does
#  not validate. The environment file is copied before it is touched. Nothing
#  here prints a secret: one line is read, one is written, and what is echoed
#  back is a hostname.
#
#  What it does not do is DNS. That happens where each name is registered, and
#  when a name is not pointing here yet this says exactly which record to add.
# ============================================================================
{
set -euo pipefail

REPO="${REPO:-/root/webliver}"
ENVFILE="${ENVFILE:-/etc/liver-next.env}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
INCLUDE="${INCLUDE:-/etc/caddy/liver-rebrand.caddy}"
SNIPPET="${SNIPPET:-/etc/caddy/liver-next.caddy}"
MARKER="${MARKER:-/etc/liver-next.rebrand}"
PORT="${PORT:-3000}"
PY="$REPO/scripts/caddy-rebrand.py"

NEW="beforeidoevent.com"
APPHOST="app.$NEW"
IL_NAMES=(beforeidoevent.co.il beforeidoevents.co.il)

STATUS_ONLY=0
YES=0
for a in "$@"; do
  [ "$a" = "--status" ] && STATUS_ONLY=1
  [ "$a" = "--yes" ] && YES=1
done

say() { printf '\n  %s\n' "$*"; }
ok()  { printf '  ok    %s\n' "$*"; }
bad() { printf '  ✗     %s\n' "$*"; }
note(){ printf '        %s\n' "$*"; }

# ── where am I ─────────────────────────────────────────────────────────────
say "1. הכתובת של השרת, והאם כל שם מצביע אליה"
MYIP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
if [ -z "$MYIP" ]; then bad "לא זוהתה כתובת השרת. אי אפשר להשוות."; exit 1; fi
ok "כתובת השרת: $MYIP"

# One address per name. A name that points somewhere else is not an error, it is
# the state of a name that has not been moved yet - but it is never served, so
# Caddy never asks for a certificate it cannot get.
resolve() { getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}' || true; }
points_here() { [ "$(resolve "$1")" = "$MYIP" ]; }

show() {
  local h="$1" ip
  ip="$(resolve "$h")"
  if [ -z "$ip" ]; then bad "$h  ← לא מצביע לשום מקום"
  elif [ "$ip" = "$MYIP" ]; then ok "$h  ← כאן"
  else bad "$h  ← $ip (לא כאן)"; fi
}

for h in "$NEW" "www.$NEW" "$APPHOST"; do show "$h"; done
for d in "${IL_NAMES[@]}"; do show "$d"; show "www.$d"; done
show liverproductions.com
show app.liverproductions.com

# The one failure that looks like a DNS problem and is not one. A .com that was
# registered recently and whose contact details were never confirmed is
# suspended by the registrar, and its name servers are replaced by two that say
# so. Nothing added to it is ever served until that is fixed.
ns_line="$(curl -fsS --max-time 10 -H 'accept: application/dns-json' \
  "https://cloudflare-dns.com/dns-query?name=${NEW}&type=NS" 2>/dev/null \
  | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(" ".join(a["data"] for a in d.get("Answer",[])))
except Exception:
    pass' 2>/dev/null || true)"
if echo "$ns_line" | grep -qi 'whois-verification\|verify-contact'; then
  say "$NEW מושעה אצל הרשם."
  note "שרתי השמות שלו הם: $ns_line"
  note "זה לא קשור ל-DNS. כשמאמתים את כתובת האימייל של הרשם, השעיה כזו משתחררת."
  note "כל עוד זה כך שום רשומה שמוסיפים לא תיכנס לתוקף."
  note "במייל מהרשם (Namecheap) יש קישור לאימות פרטי הקשר של הדומיין."
fi

MISSING=0
for h in "$NEW" "www.$NEW" "$APPHOST"; do points_here "$h" || MISSING=1; done

if [ "$MISSING" = 1 ]; then
  say "רשומות להוסיף אצל הרשם של $NEW:"
  note "type A   name @     value $MYIP"
  note "type A   name www   value $MYIP"
  note "type A   name app   value $MYIP"
  note "ואם יש שם רשומת parking קיימת על @ או על www, מוחקים אותה קודם."
fi

if [ "$STATUS_ONLY" = 1 ]; then
  say "מצב הקונפיגורציה"
  [ -e "$MARKER" ] && ok "המעבר בוצע ($MARKER)" || note "המעבר עוד לא בוצע"
  grep -m1 '^NEXT_PUBLIC_SITE_URL=' "$ENVFILE" 2>/dev/null | sed 's/^/        /' || true
  grep -m1 '^NEXT_PUBLIC_ROOT_DOMAIN=' "$ENVFILE" 2>/dev/null | sed 's/^/        /' || true
  grep -q "$INCLUDE" "$CADDYFILE" 2>/dev/null && ok "Caddy טוען את $INCLUDE" || note "Caddy עוד לא טוען את $INCLUDE"
  exit 0
fi

if [ "$MISSING" = 1 ]; then
  say "לא נשנה כלום עד ששלושת השמות החדשים מצביעים לכאן. אחרי שהרשומות נכנסו, מריצים שוב."
  exit 1
fi

# ── tools ──────────────────────────────────────────────────────────────────
command -v caddy >/dev/null || { bad "Caddy לא מותקן."; exit 1; }
[ -f "$CADDYFILE" ] || { bad "לא נמצא $CADDYFILE"; exit 1; }
[ -s "$ENVFILE" ]   || { bad "$ENVFILE חסר או ריק. לא משנים כלום."; exit 1; }
[ -f "$PY" ]        || { bad "לא נמצא $PY. צריך לעדכן את הקוד על השרת קודם."; exit 1; }
command -v python3 >/dev/null || { bad "python3 חסר."; exit 1; }

stamp="$(date +%Y%m%d-%H%M%S)"
backup="/root/caddy-backup-rebrand-${stamp}"
mkdir -p "$backup"
cp -a "$CADDYFILE" "$backup/Caddyfile"
[ -f "$INCLUDE" ] && cp -a "$INCLUDE" "$backup/liver-rebrand.caddy" || true
[ -f "$SNIPPET" ] && cp -a "$SNIPPET" "$backup/liver-next.caddy" || true
cat > "$backup/restore.sh" <<RESTORE
#!/usr/bin/env bash
# מחזיר את Caddy למצב שהיה לפני go-rebrand.sh. הרץ כ-root.
set -euo pipefail
cp -a "$backup/Caddyfile" "$CADDYFILE"
[ -f "$backup/liver-next.caddy" ] && cp -a "$backup/liver-next.caddy" "$SNIPPET" || true
if [ -f "$backup/liver-rebrand.caddy" ]; then cp -a "$backup/liver-rebrand.caddy" "$INCLUDE"; else rm -f "$INCLUDE"; fi
systemctl reload caddy
echo "  התצורה הישנה חזרה."
RESTORE
chmod +x "$backup/restore.sh"

restore_caddy() {
  cp -a "$backup/Caddyfile" "$CADDYFILE"
  [ -f "$backup/liver-next.caddy" ] && cp -a "$backup/liver-next.caddy" "$SNIPPET" || true
  if [ -f "$backup/liver-rebrand.caddy" ]; then cp -a "$backup/liver-rebrand.caddy" "$INCLUDE"; else rm -f "$INCLUDE"; fi
  caddy validate --config "$CADDYFILE" >/dev/null 2>&1 && systemctl reload caddy || true
}

apply_caddy() {
  if caddy validate --config "$CADDYFILE" >/dev/null 2>&1; then
    systemctl reload caddy
    return 0
  fi
  bad "caddy validate נכשל. מחזיר את הישן."
  caddy validate --config "$CADDYFILE" 2>&1 | tail -8 | sed 's/^/        /' || true
  restore_caddy
  return 1
}

# ── phase 1: the new names, beside the old ones ────────────────────────────
if [ ! -e "$MARKER" ]; then
  say "2. שלב א: מעלים את השמות החדשים, בלי לגעת בישנים"
  python3 "$PY" render "$INCLUDE" "$PORT" --phase 1
  python3 "$PY" import "$CADDYFILE" "$INCLUDE"
  apply_caddy || exit 1
  ok "נוספו $NEW ו-$APPHOST. הישנים ממשיכים לעבוד כמו שהיו."
  note "גיבוי: $backup  (חזרה בפקודה אחת: bash $backup/restore.sh)"

  # Asked from outside rather than believed. The certificate is requested on
  # the first connection, so the first answer can take a little while.
  say "3. בודקים מבחוץ שהם עונים בהצפנה"
  seen=0
  for _ in $(seq 1 30); do
    a="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "https://$NEW/api/version" 2>/dev/null || echo 000)"
    b="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "https://$APPHOST/login" 2>/dev/null || echo 000)"
    if [ "$a" = 200 ] && [ "$b" = 200 ]; then seen=1; break; fi
    sleep 5
  done
  if [ "$seen" != 1 ]; then
    bad "$NEW → ${a:-000},  $APPHOST → ${b:-000}"
    note "Caddy יכול לקחת דקה לסיים תעודה. מריצים שוב בעוד דקה."
    note "אם זה נשאר כך:  journalctl -u caddy -n 40 --no-pager"
    exit 1
  fi
  ok "https://$NEW → 200"
  ok "https://$APPHOST → 200"
fi

# ── the gate ───────────────────────────────────────────────────────────────
if [ ! -e "$MARKER" ]; then
  say "4. לפני המעבר: שתי הגדרות שאי אפשר לעשות מכאן"
  note "Supabase → Authentication → URL Configuration"
  note "    Site URL:       https://$APPHOST"
  note "    Redirect URLs:  https://$APPHOST/**    (משאירים גם את הקיימות)"
  note "Google Cloud → APIs & Services → Credentials → ה-OAuth client של היומן"
  note "    Authorized redirect URIs:  https://$APPHOST/api/google/callback"
  note "בלי הראשונה, כניסה עם גוגל מהכתובת החדשה לא תחזור לאפליקציה."
  note "בלי השנייה, חיבור היומן של גוגל יפסיק לעבוד."
  if [ "$YES" != 1 ]; then
    printf '\n  שתיהן הוגדרו? כדי להמשיך כתוב:  כן   (כל דבר אחר עוצר, ושום דבר לא ישתנה):  '
    read -r answer || answer=""
    if [ "$answer" != "כן" ]; then
      say "עוצרים כאן. שלב א נשאר פעיל, הישנים לא זזו. מריצים שוב כשההגדרות מוכנות."
      exit 0
    fi
  fi
fi

# ── phase 2: the three addresses the app is built from ─────────────────────
if [ ! -e "$MARKER" ]; then
  say "5. הכתובות שהאפליקציה בנויה מהן"
  cp -a "$ENVFILE" "$ENVFILE.before-rebrand"
  chmod 600 "$ENVFILE.before-rebrand"
  for k in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_PLATFORM_HOST NEXT_PUBLIC_ROOT_DOMAIN; do
    sed -i "/^${k}=/d" "$ENVFILE"
  done
  {
    printf 'NEXT_PUBLIC_SITE_URL=https://%s\n' "$NEW"
    printf 'NEXT_PUBLIC_PLATFORM_HOST=%s\n' "$NEW"
    printf 'NEXT_PUBLIC_ROOT_DOMAIN=%s\n' "$NEW"
  } >> "$ENVFILE"
  chmod 600 "$ENVFILE"
  ok "SITE_URL, PLATFORM_HOST, ROOT_DOMAIN → $NEW"
  note "הקובץ כפי שהיה נשמר ב-$ENVFILE.before-rebrand"

  # Written before the build, because the build script rewrites the Caddy
  # snippet unless it finds this. Without it the next release would put the
  # old single-host block back and the config would claim one address twice.
  printf '%s\n' "$NEW" > "$MARKER"

  TIMER_WAS_ON=0
  if systemctl is-enabled liver-agent.timer >/dev/null 2>&1; then
    TIMER_WAS_ON=1
    systemctl stop liver-agent.timer || true
    say "סוכן השחרורים הושהה בזמן הבנייה"
  fi
  restore_timer() {
    if [ "$TIMER_WAS_ON" = 1 ]; then systemctl start liver-agent.timer || true; printf '  סוכן השחרורים רץ שוב\n'; fi
  }
  trap restore_timer EXIT

  say "6. בנייה והפעלה מחדש (כמה דקות)"
  if ! bash "$REPO/deploy-next.sh"; then
    bad "הבנייה נכשלה. מחזיר את הכתובות הישנות. האתר החי לא הוחלף."
    cp -a "$ENVFILE.before-rebrand" "$ENVFILE"
    chmod 600 "$ENVFILE"
    rm -f "$MARKER"
    exit 1
  fi
fi

# ── phase 2, continued: the old names become redirects ─────────────────────
say "7. השמות הישנים מפנים לחדש"
IL_HERE=()
for d in "${IL_NAMES[@]}"; do
  if points_here "$d" && points_here "www.$d"; then IL_HERE+=("$d"); fi
done
il_arg=""
if [ "${#IL_HERE[@]}" -gt 0 ]; then il_arg="$(IFS=,; echo "${IL_HERE[*]}")"; fi

python3 "$PY" render "$INCLUDE" "$PORT" --phase 2 ${il_arg:+--il "$il_arg"}
python3 "$PY" adopt "$CADDYFILE" "$INCLUDE"
# The snippet the build script used to write holds app.liverproductions.com on
# its own; that name is in the include now, and Caddy will not load a config in
# which two blocks claim one address.
printf '# נוהל על ידי scripts/go-rebrand.sh. כל השמות נמצאים ב-%s\n' "$INCLUDE" > "$SNIPPET"
apply_caddy || exit 1
ok "liverproductions.com ו-app.liverproductions.com מפנים. /api/* ו-/feed/* ממשיכים לענות כרגיל."
for d in "${IL_NAMES[@]}"; do
  if printf '%s\n' "${IL_HERE[@]:-}" | grep -qx "$d"; then ok "$d מפנה"
  else note "$d עוד לא מצביע לכאן, אז הוא לא נכלל. אחרי שמעדכנים את הרשומות, מריצים שוב."; fi
done

# ── what the outside world actually gets ───────────────────────────────────
say "8. בדיקה מבחוץ"
sleep 3
chk() { # label, want, got
  if [ "$3" = "$2" ]; then ok "$1 → $3"; else bad "$1 → $3  (ציפינו ל-$2)"; FAIL=1; fi
}
FAIL=0
code() { curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null || echo 000; }
rcode() { curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "$1" 2>/dev/null || echo "000 "; }

chk "https://$NEW/api/version" 200 "$(code "https://$NEW/api/version")"
chk "https://$APPHOST/login" 200 "$(code "https://$APPHOST/login")"
chk "https://liverproductions.com/api/version (חייב לענות, לא להפנות)" 200 "$(code "https://liverproductions.com/api/version")"
chk "https://liverproductions.com/privacy" "301 https://$NEW/privacy" "$(rcode "https://liverproductions.com/privacy")"
chk "https://app.liverproductions.com/app" "301 https://$APPHOST/app" "$(rcode "https://app.liverproductions.com/app")"
chk "https://$NEW/login (האתר מעביר את הכניסה לאפליקציה)" "308 https://$APPHOST/login" "$(rcode "https://$NEW/login")"
for d in "${IL_HERE[@]:-}"; do
  [ -n "$d" ] && chk "https://$d/" "301 https://$NEW/" "$(rcode "https://$d/")"
done

printf '\n'
if [ "$FAIL" = 0 ]; then
  say "המעבר הסתיים. התרשים עובד."
else
  say "משהו לא ענה כמו שצריך. הגיבוי של Caddy:  bash $backup/restore.sh"
fi
say "נשאר לעשות ידנית, כי רק מי שמחזיק בחשבונות יכול:"
note "· Resend: לאמת את $NEW, ואז לעדכן MAIL_FROM. עד אז מיילים ממשיכים לצאת מהדומיין הישן."
note "· מפיקים שהדביקו כתובת webhook בקונסולת מודעות: הכתובת הישנה ממשיכה לעבוד, והחדשה תופיע במסך הערוצים."
note "· התראות דחיפה ואפליקציה מותקנת: כל אחד נכנס פעם אחת מחדש מהכתובת החדשה (העוגיות הן של כל כתובת בנפרד)."
note "· תת-דומיינים למפיקים (keren.$NEW) דורשים רשומת * ותעודה לכל שם. זה שלב נפרד."
printf '\n'
}
