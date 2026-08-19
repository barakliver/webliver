#!/usr/bin/env bash
# Deploys the site from this repository to the web root Caddy serves.
# Run on the server:  bash /root/webliver/deploy.sh
set -euo pipefail

REPO="${REPO:-/root/webliver}"
WEB="${WEB:-/var/www/site}"
BRANCH="${BRANCH:-claude/general-fixes-kqxoqc}"

cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

install -d "$WEB" "$WEB/.well-known"

cp "liver-productions (1).html" "$WEB/index.html"
cp manifest.json sw.js "$WEB/"
cp icon-*.png "$WEB/"
cp screenshot-*.png "$WEB/" 2>/dev/null || true

# Present only once a Play Store listing exists; see PWA-STORES.md.
if [ -f assetlinks.json ]; then
  cp assetlinks.json "$WEB/.well-known/assetlinks.json"
fi

echo "deployed: $(git rev-parse --short HEAD)"
ls -l "$WEB" | sed 's/^/  /'
