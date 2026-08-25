#!/usr/bin/env bash
# Deploys the site from this repository to the web root Caddy serves.
# Run on the server:  bash /root/webliver/deploy.sh
#
# The whole body sits inside a { } block on purpose. This script pulls a
# new copy of *itself* partway through, and bash reads a script
# incrementally by byte offset — so when the file grows or shrinks under
# it, execution resumes at the wrong place and a line can be skipped
# silently. That is exactly what happened on the first run of the
# 6a3a761 deploy: everything reported success and og-image.jpg never got
# copied. Wrapping the body forces bash to parse to the closing brace
# before running any of it.
{
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
cp og-image.jpg "$WEB/"        # referenced by the og:image tag
cp screenshot-*.png "$WEB/" 2>/dev/null || true

# Present only once a Play Store listing exists; see PWA-STORES.md.
if [ -f assetlinks.json ]; then
  cp assetlinks.json "$WEB/.well-known/assetlinks.json"
fi

# Every file the page actually asks for, checked rather than assumed.
missing=0
for f in index.html manifest.json sw.js og-image.jpg \
         icon-192.png icon-512.png icon-maskable-512.png; do
  if [ ! -s "$WEB/$f" ]; then
    echo "MISSING: $f"
    missing=$((missing + 1))
  fi
done

echo "deployed: $(git rev-parse --short HEAD)"
if [ "$missing" -gt 0 ]; then
  echo "WARNING: $missing file(s) did not reach $WEB — run this script again."
  exit 1
fi
echo "all files present"
exit 0
}
