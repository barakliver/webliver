#!/usr/bin/env bash
# Builds and serves the Next.js app on this droplet, behind the Caddy that
# already runs here. It goes up on its own hostname first, so the live
# single-file site keeps serving liverproductions.com untouched until you
# decide to switch.
#
#   bash /root/webliver/deploy-next.sh
#
# Wrapped in { } for the same reason deploy.sh is: this script is pulled
# from git while it runs, and bash reads a script by byte offset.
{
set -euo pipefail

REPO="${REPO:-/root/webliver}"
APP="$REPO/liver-next"
BRANCH="${BRANCH:-design-overhaul}"
HOST="${HOST:-app.liverproductions.com}"
PORT="${PORT:-3000}"

cd "$REPO"
# What is serving right now, captured before the pull moves us off it. It is
# the only thing that makes the check at the end actionable: telling somebody
# their deploy is broken without telling them what to go back to is a worse
# message than saying nothing.
PREV_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

# ── the build needs more memory than this droplet has spare ────────────────
# 1GB with MySQL and PHP-FPM already resident is not enough for next build;
# it gets killed part way and leaves no useful error. A swap file costs
# nothing when idle and makes the build survive.
if [ "$(free -m | awk '/^Swap:/{print $2}')" -lt 1024 ]; then
  echo "→ adding a 2G swap file for the build"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── node ───────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]; then
  echo "→ installing Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "→ node $(node -v)"

# ── secrets ────────────────────────────────────────────────────────────────
# Kept outside the repository so a git pull can never overwrite them and
# they are never committed by accident.
ENVFILE=/etc/liver-next.env
if [ ! -s "$ENVFILE" ]; then
  echo "MISSING: $ENVFILE"
  echo
  echo "Create it first, with your Supabase project details:"
  echo
  echo "  cat > $ENVFILE <<'EOF'"
  echo "  NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co"
  echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key"
  echo "  NEXT_PUBLIC_SITE_URL=https://$HOST"
  echo "  # the real number, digits only, with the country code and no plus."
  echo "  # leave it out entirely rather than inventing one: the code has the"
  echo "  # business's own number as its default, and a placeholder here would"
  echo "  # override it with a WhatsApp button that reaches nobody."
  echo "  # NEXT_PUBLIC_WHATSAPP_NUMBER="
  echo "  NEXT_PUBLIC_BOOKING_URL="
  echo "  EOF"
  echo
  echo "  chmod 600 $ENVFILE"
  exit 1
fi
chmod 600 "$ENVFILE"
cp "$ENVFILE" "$APP/.env.local"

# ── build ──────────────────────────────────────────────────────────────────
cd "$APP"
echo "→ installing dependencies"
npm ci --no-audit --no-fund
echo "→ building"
# Node caps its heap at about a quarter of a 1GB machine, and the type-check
# pass at the end of `next build` now needs more than that: the compile
# finished in 43s and the checker died at 490MB with "heap out of memory",
# leaving the old build running and the deploy reported as failed. The swap
# file above exists for exactly this; the cap just has to let Node use it.
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build

# ── service ────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/liver-next.service <<EOF
[Unit]
Description=Liver Productions (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP
EnvironmentFile=$ENVFILE
Environment=NODE_ENV=production
Environment=PORT=$PORT
ExecStart=$(command -v npm) run start
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable liver-next >/dev/null 2>&1 || true
systemctl restart liver-next

# ── Caddy: only once the hostname actually points here ─────────────────────
# Caddy asks Let's Encrypt for a certificate the moment a hostname appears in
# the Caddyfile. If that name does not resolve to this droplet the request
# fails, and a failing block can hold up the reload for the site already
# serving. So check DNS first; until it is set, serve on the port.
MYIP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
HOSTIP="$(getent hosts "$HOST" 2>/dev/null | awk '{print $1; exit}' || true)"
PROXIED=0

if [ -n "$HOSTIP" ] && [ "$HOSTIP" = "$MYIP" ]; then
  SNIPPET=/etc/caddy/liver-next.caddy
  cat > "$SNIPPET" <<EOF
$HOST {
	encode zstd gzip
	reverse_proxy 127.0.0.1:$PORT
}
EOF
  if ! grep -q "liver-next.caddy" /etc/caddy/Caddyfile; then
    printf '\nimport %s\n' "$SNIPPET" >> /etc/caddy/Caddyfile
  fi
  if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    PROXIED=1
  else
    echo "! Caddyfile did not validate - leaving the running site alone"
  fi
else
  echo "-> $HOST does not point at this droplet yet"
  echo "   (this droplet: ${MYIP:-unknown}, $HOST: ${HOSTIP:-not set})"
  echo "   serving on the port directly until the DNS record exists"
  ufw allow "$PORT"/tcp >/dev/null 2>&1 || true
fi

# ── did it actually come up ────────────────────────────────────────────────
echo "→ waiting for the app to answer"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then ok=1; break; fi
  sleep 2
done

# ── does every screen actually draw something ──────────────────────────────
# A server that answers is not a server that works. The check this replaces
# asked for a status code, and a shell whose main region rendered nothing
# answers 200 with a healthy header, menu and footer around an empty hole —
# which is how six screens were blank through a deploy that reported sixty-two
# passes. verify.mjs now reads inside the main region of every primary route.
VERIFIED=0
if [ "$ok" -eq 1 ]; then
  echo
  echo "→ checking that every screen draws something"
  if VERIFY_URL="http://127.0.0.1:$PORT" node "$APP/scripts/verify.mjs"; then
    VERIFIED=1
  fi
fi

echo
echo "commit:  $(cd "$REPO" && git rev-parse --short HEAD)"
if [ "$ok" -eq 1 ]; then
  if [ "$PROXIED" -eq 1 ]; then
    echo "open:    https://$HOST"
  else
    echo "open:    http://${MYIP:-164.92.132.64}:$PORT"
    echo
    echo "to move it onto $HOST, add this DNS record at your registrar:"
    echo "    type A    name app    value ${MYIP:-164.92.132.64}"
    echo "then run this script again."
  fi
  if [ "$VERIFIED" -eq 1 ]; then
    echo "OK"
  else
    echo
    echo "the app is up, but the check above found screens that do not draw."
    echo "this build is live and it is not right. go back to the one that was:"
    echo
    echo "    cd $REPO && git checkout $PREV_SHA -- liver-next && bash $REPO/deploy-next.sh"
    echo
    echo "then send the FAIL lines above, they name the exact screens."
    exit 1
  fi
else
  echo "the app did not answer on port $PORT"
  echo "logs:  journalctl -u liver-next -n 40 --no-pager"
  echo
  echo "the build that was serving before this one:  $PREV_SHA"
  exit 1
fi
exit 0
}
