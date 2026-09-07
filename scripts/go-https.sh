#!/usr/bin/env bash
# ============================================================================
#  Move the platform onto its own name, over HTTPS
# ============================================================================
#  Run once, on the droplet, after the DNS record for app.liverproductions.com
#  exists:
#
#      bash /root/webliver/scripts/go-https.sh
#
#  deploy-next.sh already knows how to do the Caddy half — it writes the
#  hostname block and reloads, and Caddy fetches the certificate from Let's
#  Encrypt on its own. This exists for the three things around it that are
#  easy to miss and expensive to get wrong.
#
#  First: NEXT_PUBLIC_SITE_URL. It is baked into the build, and it is what
#  every generated link is built from — the page a couple sends two hundred
#  guests, the link a photographer opens, the address on a contract somebody
#  signs. Turning HTTPS on without moving it leaves every one of those links
#  pointing at a bare IP over plain http, and they are links that get sent to
#  other people and live in their phones for months. The variable's own guard
#  in env.ts catches localhost and does not catch an IP address.
#
#  Second: the release agent builds on a timer, and a build on a one gigabyte
#  machine takes minutes. Two at once is how both of them die on memory. So
#  the timer is stopped for the duration and started again at the end,
#  including if this script fails.
#
#  Third: the environment file holds the database password and the service
#  key. Nothing here prints it. One line is read, one line is written, and
#  what is echoed back is the hostname — never the file.
# ============================================================================
{
set -euo pipefail

REPO="${REPO:-/root/webliver}"
ENVFILE="${ENVFILE:-/etc/liver-next.env}"
HOST="${HOST:-app.liverproductions.com}"
WANT="https://$HOST"

say() { printf '  %s\n' "$*"; }

printf '\n'

# ── the name has to point here first ───────────────────────────────────────
#  Caddy asks for a certificate the moment the hostname appears in its
#  config. If the name does not resolve to this machine the request fails,
#  and a failing block can hold up the reload for the site already serving
#  liverproductions.com. So this is checked rather than attempted.
MYIP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
HOSTIP="$(getent hosts "$HOST" 2>/dev/null | awk '{print $1; exit}' || true)"

if [ -z "$HOSTIP" ]; then
  say "FAIL  $HOST does not resolve yet."
  say "      Add an A record at the registrar: name app, value ${MYIP:-the IP of this droplet}."
  say "      DNS can take a few minutes to spread. Nothing was changed."
  exit 1
fi
if [ "$HOSTIP" != "$MYIP" ]; then
  say "FAIL  $HOST points at $HOSTIP, and this droplet is ${MYIP:-unknown}."
  say "      Fix the A record before running this. Nothing was changed."
  exit 1
fi
say "$HOST points here."

# ── the address every generated link is built from ─────────────────────────
if [ ! -s "$ENVFILE" ]; then
  say "FAIL  $ENVFILE is missing or empty. Nothing was changed."
  exit 1
fi

COUNT="$(grep -c '^NEXT_PUBLIC_SITE_URL=' "$ENVFILE" || true)"
CURRENT="$(grep -m1 '^NEXT_PUBLIC_SITE_URL=' "$ENVFILE" | cut -d= -f2- || true)"

if [ "$COUNT" -gt 1 ]; then
  say "note: $COUNT NEXT_PUBLIC_SITE_URL lines were in the file; only the first"
  say "      was ever read. Replacing all of them with one."
fi

if [ "$CURRENT" = "$WANT" ]; then
  say "the site address is already $WANT"
else
  cp -a "$ENVFILE" "$ENVFILE.before-https"
  chmod 600 "$ENVFILE.before-https"
  sed -i '/^NEXT_PUBLIC_SITE_URL=/d' "$ENVFILE"
  printf 'NEXT_PUBLIC_SITE_URL=%s\n' "$WANT" >> "$ENVFILE"
  chmod 600 "$ENVFILE"
  say "site address: ${CURRENT:-(was not set)}  ->  $WANT"
  say "the file as it was is kept at $ENVFILE.before-https"
fi

# ── one build at a time ────────────────────────────────────────────────────
TIMER_WAS_ON=0
if systemctl is-enabled liver-agent.timer >/dev/null 2>&1; then
  TIMER_WAS_ON=1
  systemctl stop liver-agent.timer || true
  say "release agent paused for the build"
fi
restore_timer() {
  if [ "$TIMER_WAS_ON" = 1 ]; then
    systemctl start liver-agent.timer || true
    printf '  release agent running again\n'
  fi
}
trap restore_timer EXIT

# ── build, and let Caddy take it from here ─────────────────────────────────
printf '\n'
bash "$REPO/deploy-next.sh"

# ── what the outside world actually gets ───────────────────────────────────
#  Asked from outside rather than believed. `-o /dev/null` because the page is
#  not the point; the code and the certificate are.
printf '\n'
CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "$WANT/" 2>/dev/null || echo 000)"
if [ "$CODE" = "200" ]; then
  say "$WANT answers 200 over HTTPS."
  say "The certificate is from Let's Encrypt and Caddy renews it on its own."
else
  say "$WANT answered $CODE."
  say "Caddy can take a minute to finish the certificate on a first request."
  say "Try the address in a browser; if it is still wrong:"
  say "  journalctl -u caddy -n 40 --no-pager"
fi
printf '\n'
}
