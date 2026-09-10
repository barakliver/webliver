#!/usr/bin/env bash
# ============================================================================
#  The agent that releases without you
# ============================================================================
#  Runs every five minutes on the droplet, does nothing almost every time, and
#  once in a while notices a release has been marked and puts it live.
#
#  It deploys a MARKER, never the working branch. Work in progress is pushed
#  to design-overhaul all day and none of it goes anywhere; a release happens
#  when the marker is moved to the commit that should be live, and moving it
#  is a separate deliberate act. The agent deploys that exact commit, which is
#  not necessarily the head of the branch by the time it wakes up.
#
#  The marker is the branch `release`, and failing that the newest `release-*`
#  tag. Two spellings of one idea, for one practical reason: the assistant
#  that writes the code can push a branch and cannot push a tag, so a tag-only
#  marker meant every release still needed a person at a keyboard — which is
#  the thing this agent exists to stop needing. The branch wins where both
#  exist, because two markers each claiming to be current is how an unattended
#  thing deploys the wrong commit in the middle of the night.
#
#  Whatever the marker points at must be a commit that came through
#  design-overhaul. That is checked, not assumed: the branch is where every
#  test and every checker this project has actually runs, and a release that
#  skipped it has been checked by nothing.
#
#  What it does, in order, and why that order:
#
#    1. Refuses to run twice at once. A build on a one gigabyte machine takes
#       minutes and the timer fires every five, so without a lock two builds
#       eventually overlap and both die on memory.
#    2. Backs up the database before touching the schema. This is the step
#       that exists because somebody said, in capitals, that a version update
#       must never destroy their data.
#    3. Levels the schema with sync.sql, then applies whatever migrations the
#       release itself adds, then the code. Levelling on every release rather
#       than only applying what is new is the lesson of a live database that
#       had silently never had migration 0036: opening an event failed for
#       weeks and nothing named the missing piece. sync.sql is every
#       migration's DDL and none of their data statements, so it can add a
#       column or restore a policy and cannot change a row — asserted by
#       `npm run check` against a real Postgres holding a real wedding.
#
#       Schema before code, always. Both files only ever add, so a newer
#       schema under older code is a schema with columns nobody reads yet,
#       which is harmless. The reverse is not: older schema under newer code
#       is a screen asking for a column that is not there.
#    4. Checks that every screen still draws something, and if it does not,
#       puts the previous release back without being asked.
#    5. Brings the crontab up to whatever this release expects. Everything
#       else here arrives with the pull; a scheduled job does not, and the
#       gap between "the code for the Monday letter is live" and "the Monday
#       letter is scheduled" was a person remembering.
#
#  Nothing here is clever, on purpose. It is going to run unattended at three
#  in the morning against a live wedding platform.
#
#      bash /root/webliver/scripts/agent-deploy.sh          # what the timer runs
#      bash /root/webliver/scripts/agent-deploy.sh --dry    # decide, do nothing
#      bash /root/webliver/scripts/agent-deploy.sh --now    # ignore the marker, deploy the branch head
# ============================================================================
set -euo pipefail

REPO="${REPO:-/root/webliver}"
APP="$REPO/liver-next"
BRANCH="${BRANCH:-design-overhaul}"
PORT="${PORT:-3000}"
ENVFILE="${ENVFILE:-/etc/liver-next.env}"

STATE_DIR="${STATE_DIR:-/var/lib/liver-agent}"
BACKUP_DIR="${BACKUP_DIR:-$STATE_DIR/backups}"
DEPLOYED="$STATE_DIR/deployed"     # the tag that is live
PREVIOUS="$STATE_DIR/previous"     # the tag before it, for going back
GAVEUP="$STATE_DIR/gave-up"        # a tag that failed twice and will not be tried again
TRIED="$STATE_DIR/tried"           # "<tag> <count>", how many goes this one has had
LOG="$STATE_DIR/agent.log"
LOCK="$STATE_DIR/lock"

# How many times a tag that fails is worth trying again. A deploy can fail
# because npm could not reach the network for ninety seconds, which is worth
# one more go; it can also fail because the code is broken, which is not worth
# another go every five minutes forever. Two attempts separates those.
TRIES="${TRIES:-2}"

# Tags that mean "put this live". Anything else is just a tag.
PATTERN="${PATTERN:-release-*}"

# The other way to say "put this live": a branch that points at the commit to
# release. It exists because the assistant that writes the code can push a
# branch and cannot push a tag — the environment it runs in refuses tag refs —
# so a tag-only marker meant every release needed a person at a keyboard, which
# is the thing this whole agent was built to stop needing.
#
# Same two-stage shape either way. Work lands on design-overhaul all day and
# goes nowhere; moving this branch is the separate, deliberate act that
# releases it. Whoever moves it, moves it on purpose.
MARKER="${MARKER:-release}"

DRY=0; FORCE_BRANCH=0
for a in "$@"; do
  case "$a" in
    --dry) DRY=1 ;;
    --now) FORCE_BRANCH=1 ;;
  esac
done

mkdir -p "$STATE_DIR" "$BACKUP_DIR"

say() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG"; }

# ── one at a time ───────────────────────────────────────────────────────────
exec 9>"$LOCK"
if ! flock -n 9; then
  # Not an error. The previous run is still building, which is normal on this
  # machine, and saying so every five minutes would bury the log.
  exit 0
fi

cd "$REPO"

# ── what, if anything, to deploy ────────────────────────────────────────────
git fetch --quiet origin "$BRANCH" --tags --force
# Separately, and allowed to fail: the marker branch does not exist until
# somebody makes the first release with it, and a missing ref must not take
# the agent down with it.
git fetch --quiet origin "$MARKER" 2>/dev/null || true

if [ "$FORCE_BRANCH" -eq 1 ]; then
  TARGET="origin/$BRANCH"
  # The commit, not a description of it. This name is written down as the
  # thing that is live, and the next release hands it to git checkout to go
  # back to — so a friendly label here ("branch head, forced by hand") is a
  # rollback that fails at the only moment it is needed. It is shown to a
  # person as well, which is why the short form is spelled out in the log.
  TAG="$(git rev-parse "$TARGET")"
  say "forced: deploying the head of $BRANCH (${TAG:0:7}) rather than a release tag"
else
  # The marker branch first, a release tag second. Not a race between them:
  # once the marker exists it is the only thing consulted, because two markers
  # both claiming to be current is how an unattended thing deploys the wrong
  # commit at three in the morning.
  if git rev-parse --quiet --verify "refs/remotes/origin/$MARKER" >/dev/null; then
    TAG="$(git rev-parse "origin/$MARKER")"

    # The marker must point at something that came through the working branch.
    # Without this, anything that can push the marker can put arbitrary code
    # live without it ever having been on design-overhaul — and the branch is
    # where every check this project has actually runs.
    if ! git merge-base --is-ancestor "$TAG" "origin/$BRANCH"; then
      say "FAIL  $MARKER points at ${TAG:0:7}, which is not on $BRANCH. Refusing."
      say "      A release has to be a commit that came through the branch."
      exit 1
    fi
  else
    TAG="$(git tag -l "$PATTERN" --sort=-creatordate | head -1)"
  fi

  if [ -z "$TAG" ]; then
    say "nothing marked for release yet; nothing to do"
    exit 0
  fi
  if [ -f "$DEPLOYED" ] && [ "$(cat "$DEPLOYED")" = "$TAG" ]; then
    exit 0   # already live, and quietly
  fi
  # A tag this agent has already given up on. Without this the loop is:
  # deploy fails, roll back, the tag is still the newest one, wake up five
  # minutes later and do the whole thing again — a pg_dump of the entire
  # database and an email, every five minutes, until somebody notices. The
  # release that failed is not going to start working on its own.
  if [ -f "$GAVEUP" ] && [ "$(cat "$GAVEUP")" = "$TAG" ]; then
    exit 0   # already said so, in the log, when it happened
  fi
  TARGET="$TAG"
fi

# ^{commit} because an annotated tag resolves to the tag object, not to what it
# points at — so without it the log prints a hash that appears nowhere in the
# history, which is a confusing thing to hand somebody who is reading the log
# precisely because something went wrong.
SHA="$(git rev-parse --short "$TARGET^{commit}")"
say "release $TAG ($SHA) is not live yet"

if [ "$DRY" -eq 1 ]; then
  say "dry run, stopping here"
  exit 0
fi

# ── the schema this release expects ─────────────────────────────────────────
# Read the connection string without exporting the whole env file into this
# shell: it holds the service role key and several others that have no business
# being in the environment of a script that shells out.
DB_URL="$(grep -E '^DATABASE_URL=' "$ENVFILE" 2>/dev/null | cut -d= -f2- || true)"

if [ -z "$DB_URL" ]; then
  say "FAIL  DATABASE_URL is not in $ENVFILE, so the schema cannot be applied."
  say "      Run: bash $REPO/scripts/set-db-url.sh"
  say "      Without it this agent would deploy code against yesterday's"
  say "      schema, which is the one failure it exists to prevent. Stopping."
  exit 1
fi

# The line above took the first match, so a second one is being ignored — and
# an unattended thing quietly using the older of two connection strings is
# worth stopping for rather than guessing about.
if [ "$(grep -cE '^DATABASE_URL=' "$ENVFILE" 2>/dev/null || true)" -gt 1 ]; then
  say "FAIL  $ENVFILE has more than one DATABASE_URL line, and the first wins."
  say "      Run: bash $REPO/scripts/set-db-url.sh   (it replaces all of them)"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  say "FAIL  psql is not installed.  apt-get install -y postgresql-client"
  exit 1
fi

# The migrations are checked before they are applied, not after. This is the
# same check that runs in development; running it here means a release that
# somehow got tagged with a broken migration stops before it reaches the data.
cd "$APP"
git -C "$REPO" checkout --quiet --detach "$TARGET"
if ! node scripts/check-sql.mjs >/dev/null 2>&1; then
  say "FAIL  the migrations in $TAG do not pass their own checker. Not applying."
  git -C "$REPO" checkout --quiet "$BRANCH" || true
  exit 1
fi

# ── the backup, which is the whole reason this can be automatic ─────────────
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/before-$TAG-$STAMP.sql.gz"
say "backing up to $DUMP"
if pg_dump --no-owner --no-privileges "$DB_URL" 2>>"$LOG" | gzip > "$DUMP"; then
  SIZE="$(du -h "$DUMP" | cut -f1)"
  say "backup ok ($SIZE)"
else
  rm -f "$DUMP"
  say "FAIL  the backup did not complete, so the schema will not be touched."
  say "      Deploying without one is exactly what must never happen here."
  git -C "$REPO" checkout --quiet "$BRANCH" || true
  exit 1
fi
# Two weeks of them. Older ones are worth less than the disk on this machine.
find "$BACKUP_DIR" -name 'before-*.sql.gz' -mtime +14 -delete 2>/dev/null || true

# ── only the migrations this release actually adds ──────────────────────────
# This used to apply setup.sql, the whole history concatenated, on the
# assumption that it was safe to re-run. It is not, and the reason is worth
# writing down because it is invisible until it happens.
#
# setup.sql is idempotent for tables and columns — every one of those is
# `if not exists`. It is not idempotent for a function whose signature ever
# changed. producer_by_host is created in 0031 and dropped and recreated with
# a different return type in 0046. On an empty database that is fine: 0031
# creates it, 0046 replaces it. On a database that is already current, 0031's
# `create or replace` meets 0046's function and tries to change the return
# type back, and Postgres refuses outright: "cannot change return type of
# existing function". So the file works exactly once, on a fresh database,
# which is the one case an automatic release never has.
#
# What a release actually needs is the migrations it adds — nothing else has
# any business running again. Each one is written to be safe on its own, and
# the set of them is a fact git can be asked for rather than a guess.
OLD_TAG="$(cat "$DEPLOYED" 2>/dev/null || echo '')"
MIGDIR="liver-next/supabase/migrations"

# ── first, level the schema ─────────────────────────────────────────────────
# sync.sql is every migration's DDL and none of their data statements. Running
# it here, on every release, is what stops a database quietly drifting behind
# the code — which is not a hypothetical: 0036 had never been applied to the
# live database, opening an event failed with a row level security refusal for
# weeks, and nothing anywhere named the missing migration. Applying only what a
# release adds cannot repair that, because the gap predates the release.
#
# It is safe to run over live data, and that is asserted rather than believed:
# `npm run check` stands a real Postgres up, puts a wedding in it with its
# payment, its schedule and a lead, runs this file over it twice, and compares
# every value including the guest token. Three separate mutations of the file
# were put back to prove the test can fail.
#
# It only ever adds. A missing column, a policy that was never applied, a
# function replaced with its current version.
if [ -f "$APP/supabase/sync.sql" ]; then
  say "levelling the schema"
  if ! psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$DB_URL" -f "$APP/supabase/sync.sql" >>"$LOG" 2>&1; then
    say "FAIL  the schema could not be levelled. Nothing was deployed."
    say "      No row is changed by that file, so the data is as it was."
    say "      See $LOG."
    git -C "$REPO" checkout --quiet "$BRANCH" || true
    exit 1
  fi
  say "schema levelled"
else
  say "note: this release predates sync.sql, so the schema was not levelled"
fi

if [ -z "$OLD_TAG" ] || ! git -C "$REPO" cat-file -e "${OLD_TAG}^{commit}" 2>/dev/null; then
  # No record of what is live means no way to work out what is new. Applying
  # the whole history instead is what this change exists to stop doing, so
  # nothing is applied — which cannot damage anything — and it is said out
  # loud. A release that then needs a missing column fails its own screen
  # checks and rolls back, which is the net working as intended.
  say "no record of the live commit, so no migration is applied by this run."
  say "      If this release adds any, run them in the SQL editor first."
  NEW_MIGS=""
else
  NEW_MIGS="$(git -C "$REPO" diff --name-only --diff-filter=A "$OLD_TAG" "$TARGET" -- "$MIGDIR" 2>/dev/null || true)"
  EDITED="$(git -C "$REPO" diff --name-only --diff-filter=M "$OLD_TAG" "$TARGET" -- "$MIGDIR" 2>/dev/null || true)"
  # An already-applied migration that has been edited will never reach the
  # database, because it is not new and will not be run again. Usually that is
  # a comment; occasionally it is somebody expecting an edit to take effect.
  if [ -n "$EDITED" ]; then
    say "note: these already-applied migrations were edited, and edits to them"
    say "      do not reach the database:"
    printf '%s\n' "$EDITED" | while read -r f; do say "        ${f##*/}"; done
  fi
fi

if [ -z "$NEW_MIGS" ]; then
  say "no new migrations in this release; the levelling above was all of it"
else
  COUNT="$(printf '%s\n' "$NEW_MIGS" | grep -c . || true)"
  # Their DDL is already in from sync.sql; this is for the one-time data
  # each of them carries — a backfill, a seeded row — which sync.sql strips.
  say "applying $COUNT new migration(s) for the data they carry"
  # In order. They are numbered, and a later one can depend on an earlier one.
  while read -r f; do
    [ -n "$f" ] || continue
    say "  ${f##*/}"
    if ! psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$DB_URL" -f "$REPO/$f" >>"$LOG" 2>&1; then
      say "FAIL  ${f##*/} did not apply. The database is untouched past the last"
      say "      statement that worked, and the backup above predates all of it."
      say "      Nothing was deployed. See $LOG."
      git -C "$REPO" checkout --quiet "$BRANCH" || true
      exit 1
    fi
  done <<< "$(printf '%s\n' "$NEW_MIGS" | sort)"
  say "schema applied"
fi

# ── the code ────────────────────────────────────────────────────────────────

# Which go this is. Counted before the attempt rather than after, so a run that
# is killed halfway — the machine runs out of memory during a build, which on a
# gigabyte is the likeliest way this ever dies — still counts as a go.
ATTEMPT=1
if [ -f "$TRIED" ]; then
  read -r PREV_TAG PREV_N < "$TRIED" || true
  [ "${PREV_TAG:-}" = "$TAG" ] && ATTEMPT=$(( ${PREV_N:-0} + 1 ))
fi
printf '%s %s\n' "$TAG" "$ATTEMPT" > "$TRIED"

say "deploying $TAG (attempt $ATTEMPT of $TRIES)"
if REF="$TARGET" bash "$REPO/deploy-next.sh" >>"$LOG" 2>&1; then
  say "deployed and every screen draws something"
  # The one thing a release cannot carry by itself. Code and schema arrive
  # with the pull; the crontab lives on this machine and in no repository,
  # so a release that adds a scheduled job used to sit there unscheduled
  # until somebody noticed. Quiet, idempotent, and silent about a key it
  # does not have.
  bash "$REPO/scripts/ensure-schedule.sh" >>"$LOG" 2>&1 || say "the schedule could not be brought up to date"
  [ -n "$OLD_TAG" ] && printf '%s' "$OLD_TAG" > "$PREVIOUS"
  printf '%s' "$TAG" > "$DEPLOYED"
  RESULT="ok"
else
  say "FAIL  the release is up and the check found screens that do not draw."

  # Going back. The schema stays where it is and that is correct: setup.sql
  # only adds, so the older code simply does not use the newer columns. Trying
  # to reverse a schema automatically is how an automatic system destroys data,
  # which is the thing it was built not to do.
  if [ -n "$OLD_TAG" ]; then
    say "putting $OLD_TAG back"
    if REF="$OLD_TAG" bash "$REPO/deploy-next.sh" >>"$LOG" 2>&1; then
      say "rolled back to $OLD_TAG, which is serving now"
      RESULT="rolled-back"
    else
      say "FAIL  the rollback also failed. The site needs a person."
      RESULT="broken"
    fi
  else
    say "no previous release to go back to. The site needs a person."
    RESULT="broken"
  fi

  if [ "$ATTEMPT" -ge "$TRIES" ]; then
    printf '%s' "$TAG" > "$GAVEUP"
    say "giving up on $TAG after $ATTEMPT attempts. It will not be tried again."
    say "      Fix it, tag the fix as a new release, and the agent picks that up."
    say "      To make it try this one again: rm $GAVEUP"
  else
    say "will try $TAG once more on the next run"
  fi
fi

git -C "$REPO" checkout --quiet "$BRANCH" 2>/dev/null || true

# ── telling somebody ────────────────────────────────────────────────────────
# Only when it matters. A message every five minutes is a message nobody
# reads, so a quiet success on a tag is a line in the log and nothing else;
# a rollback or a broken site is worth waking up for.
KEY="$(grep -E '^RESEND_API_KEY=' "$ENVFILE" 2>/dev/null | cut -d= -f2- || true)"
TO="$(grep -E '^NEXT_PUBLIC_CONTACT_EMAIL=' "$ENVFILE" 2>/dev/null | cut -d= -f2- || echo 'barakliver@gmail.com')"

if [ -n "$KEY" ] && [ "$RESULT" != "ok" ]; then
  BODY="$(tail -30 "$LOG" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')"
  curl -sS -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"from\":\"liver <onboarding@resend.dev>\",\"to\":[\"$TO\"],\"subject\":\"הפריסה של $TAG לא עברה\",\"text\":\"$BODY\"}" \
    >/dev/null 2>&1 || true
fi

printf '%s\n' "$RESULT"
[ "$RESULT" = "ok" ]
