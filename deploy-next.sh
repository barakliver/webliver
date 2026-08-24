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
BRANCH="${BRANCH:-claude/general-fixes-kqxoqc}"
HOST="${HOST:-app.liverproductions.com}"
PORT="${PORT:-3000}"

cd "$REPO"
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
  echo "  NEXT_PUBLIC_WHATSAPP_NUMBER=972500000000"
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
  echo "OK"
else
  echo "the app did not answer on port $PORT"
  echo "logs:  journalctl -u liver-next -n 40 --no-pager"
  exit 1
fi
exit 0
}
