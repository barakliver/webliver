#!/usr/bin/env bash
# Stand up a throwaway Postgres, apply the schema, and attack the boundary.
# Touches nothing outside its own temporary directory.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
port="${PGTESTPORT:-$((5440 + RANDOM % 500))}"

# Postgres refuses to run as root, which is exactly who a container shell
# usually is. Drop to an unprivileged user rather than telling somebody to.
runner="${PGTESTUSER:-pgtest}"
if [ "$(id -u)" -eq 0 ]; then
  id "$runner" >/dev/null 2>&1 || useradd -m "$runner"
  work="$(su "$runner" -c 'mktemp -d')"
  as() { su "$runner" -c "PATH=$PATH PGHOST=$work PGPORT=$port PGUSER=postgres $*"; }
else
  work="$(mktemp -d)"
  as() { eval "$@"; }
fi

pgbin=""
for d in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql@16/bin; do
  [ -x "$d/initdb" ] && pgbin="$d" && break
done
if [ -z "$pgbin" ]; then
  command -v initdb >/dev/null || { echo "no postgres found — install one, or skip this check"; exit 2; }
  pgbin="$(dirname "$(command -v initdb)")"
fi
export PATH="$pgbin:$PATH"

cleanup() { as "pg_ctl -D $work/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

as "initdb -D $work/data -U postgres --auth=trust" >/dev/null
as "pg_ctl -D $work/data -l $work/log -o '-p $port -k $work' -w start" >/dev/null
export PGHOST="$work" PGPORT="$port" PGUSER=postgres

psql -q -c "create database liver;"
psql -q -d liver -c "alter database liver set search_path to \"\$user\", public, extensions;"

# Notices are the file reporting that it is being applied over itself, which
# is the intended state and not news.
run() { psql -v ON_ERROR_STOP=1 -q -d liver -f "$1" 2>&1 | grep -vE "NOTICE:|already exists, skipping" || true; }

run "$here/supabase/test/00_shim.sql"
echo "  ok    the schema applies"
run "$here/supabase/setup.sql" 2>&1 | grep -v "NOTICE:" || true

# Re-runnable is not optional: this file is applied over live data every deploy.
run "$here/supabase/setup.sql"
echo "  ok    and applies again over itself"

run "$here/supabase/test/01_seed.sql"

fails=0

# A test that errors produces neither PASS nor FAIL, and an earlier version of
# this simply printed nothing for it — a broken check read exactly like a check
# that was never written. Silence is now a failure.
check() {
  local raw out
  raw="$(psql -tA -d liver -f "$1" 2>&1)"
  out="$(echo "$raw" | grep -E '^(PASS|FAIL)' || true)"

  if [ -z "$out" ]; then
    echo "  FAIL  $(basename "$1") produced no result:"
    echo "$raw" | grep -iE 'error|warning' | head -3 | sed 's/^/          /'
    fails=1
    return
  fi

  while IFS= read -r line; do
    [ -z "$line" ] && continue
    case "$line" in
      PASS*) echo "  ok    ${line#PASS — }" ;;
      *)     echo "  FAIL  ${line#FAIL — }"; fails=1 ;;
    esac
  done <<< "$out"
}

check "$here/supabase/test/02_boundary.sql"
check "$here/supabase/test/03_invite.sql"
check "$here/supabase/test/04_move.sql"

echo
psql -tA -d liver -f "$here/supabase/verify.sql" | sed 's/|/  /' | while IFS= read -r l; do
  case "$l" in ok*) echo "  ok    ${l#ok  }";; *) echo "  MISSING $l"; fails=1;; esac
done

psql -tA -d liver -f "$here/supabase/verify.sql" | grep -q '^MISSING' && fails=1

if [ "$fails" -ne 0 ]; then
  echo
  echo "  the schema is not safe to deploy"
  exit 1
fi
echo
echo "  the schema applies, re-applies, and holds its boundary"
exit 0
