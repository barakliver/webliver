#!/usr/bin/env bash
# ============================================================================
#  The crontab lines this release expects, put there.
#
#      bash /root/webliver/scripts/ensure-schedule.sh
#
#  The one thing a version update could not carry. Code and schema reach the
#  droplet on their own, because the agent pulls them; the crontab lives on
#  the machine and in no repository, so a release that adds a scheduled job
#  used to need a person at a keyboard to notice. This is what the agent
#  runs after every successful deploy, and what set-cron-key.sh runs after
#  writing the key.
#
#  Quiet and idempotent by construction. It replaces its own tagged lines and
#  nothing else, it restarts nothing, it calls nothing, and with no CRON_KEY
#  written yet it says so once and leaves the crontab alone: a schedule
#  calling a door with no key is four failures a night in a log nobody reads.
# ============================================================================
set -euo pipefail

ENVFILE="${ENVFILE:-/etc/liver-next.env}"
HOST="${HOST:-https://liverproductions.com}"
TAG="# liver-sweep"
LOG="${LOG:-/var/log/liver-sweep.log}"

if [ ! -f "$ENVFILE" ] || ! grep -qE '^CRON_KEY=.+' "$ENVFILE"; then
  echo "  no CRON_KEY yet, so nothing is scheduled.  bash /root/webliver/scripts/set-cron-key.sh"
  exit 0
fi

# Each line reads the key from the environment file at run time, so rotating
# the key never needs the crontab touched:
#   nightly at 04:17: close events, anniversaries, and the weekly letters on
#                     their weekday;
#   Sunday 09:00:     the budget letter at the hour it was asked for;
#   Monday 08:00:     the supplier letter at the hour it was asked for;
#   every 15 minutes: the Google Calendar twins, both directions, which does
#                     nothing at all until a producer has connected one.
# The weekly letters are once per week per event, so the extra runs are quiet
# when the nightly one already sent them.
CALL="curl -sS -m 120 -X POST -H \"x-cron-key: \$(grep '^CRON_KEY=' $ENVFILE | cut -d= -f2-)\""
LINES="17 4 * * * $CALL $HOST/api/cron >> $LOG 2>&1 $TAG
0 9 * * 0 $CALL '$HOST/api/cron?job=digest' >> $LOG 2>&1 $TAG
0 8 * * 1 $CALL '$HOST/api/cron?job=vendors' >> $LOG 2>&1 $TAG
*/15 * * * * $CALL '$HOST/api/cron?job=gsync' > /dev/null 2>&1 $TAG"

CURRENT="$(crontab -l 2>/dev/null || true)"
WANTED="$(printf '%s\n' "$CURRENT" | grep -v "$TAG" | grep -v '/api/cron' || true)"
WANTED="$(printf '%s\n%s\n' "$WANTED" "$LINES" | sed '/^$/d')"

if [ "$(printf '%s\n' "$CURRENT" | sed '/^$/d')" = "$WANTED" ]; then
  echo "  the schedule is already what this release expects"
  exit 0
fi

# Any older line that calls the sweep goes with them: one was installed by
# hand before these scripts existed, at the same minute, with a key of its own.
printf '%s\n' "$WANTED" | crontab -
echo "  the schedule was brought up to date: nightly 04:17, Sunday 09:00, Monday 08:00, Google every 15 minutes"
