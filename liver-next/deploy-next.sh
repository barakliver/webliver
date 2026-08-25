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

# ── Caddy: a new hostname, leaving the existing site alone ─────────────────
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
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy

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
  echo "running: http://127.0.0.1:$PORT  →  https://$HOST"
  echo "OK"
else
  echo "the app did not answer on port $PORT"
  echo "logs:  journalctl -u liver-next -n 40 --no-pager"
  exit 1
fi
exit 0
}
