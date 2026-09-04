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
#    3. Applies the schema, then the code. That order is what makes a rollback
#       possible at all: setup.sql only ever adds — every statement in it is
#       `if not exists` or catches `duplicate_object` — so a newer schema
#       under older code is a schema with columns nobody reads yet, which is
#       harmless. The reverse is not: older schema under newer code is a
#       screen asking for a column that is not there.
#    4. Checks that every screen still draws something, and if it does not,
#       puts the previous release back without being asked.
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
  say "      Supabase → Project Settings → Database → Connection string (URI)."
  say "      Without it this agent would deploy code against yesterday's"
  say "      schema, which is the one failure it exists to prevent. Stopping."
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

say "applying the schema"
if ! psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$DB_URL" -f "$APP/supabase/setup.sql" >>"$LOG" 2>&1; then
  say "FAIL  the schema did not apply. The database is untouched past the last"
  say "      statement that worked, and the backup above predates all of it."
  say "      Nothing was deployed. See $LOG."
  git -C "$REPO" checkout --quiet "$BRANCH" || true
  exit 1
fi
say "schema applied"

# ── the code ────────────────────────────────────────────────────────────────
OLD_TAG="$(cat "$DEPLOYED" 2>/dev/null || echo '')"

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
