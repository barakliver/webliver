/**
 * setup.sql is every migration, in order, in one file.
 *
 * It exists because the alternative is asking somebody to paste eleven files
 * into a SQL editor in the right order, and the first time one is pasted out
 * of order or skipped the failure lands hundreds of lines away from the cause.
 *
 * It is generated rather than edited. A hand-maintained copy drifts from the
 * migrations it is supposed to be, and the drift is invisible until the day a
 * fresh database is built from it and comes out different from the live one.
 *
 * FOR A FRESH DATABASE ONLY. It is not re-runnable, and the reason is not
 * obvious enough to leave unwritten: every table and column in here is
 * `if not exists`, so re-running looks safe right up until it meets a function
 * whose signature changed. producer_by_host is created in 0031 and dropped and
 * recreated with a different return type in 0046. Run in order on an empty
 * database that is correct. Run against a database that is already current,
 * 0031's `create or replace` meets 0046's function, tries to put the old
 * return type back, and Postgres refuses: "cannot change return type of
 * existing function".
 *
 * So an existing database is brought forward by applying the migrations it
 * does not have yet, one at a time — which is what the release agent does —
 * and never by running this file again.
 *
 *     node scripts/build-setup-sql.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'migrations');

const header = `-- ============================================================================
--  Liver productions - full first-time setup
--
--  Paste this whole file into the Supabase SQL Editor and press Run. It is
--  every migration in order, so there is nothing to get wrong about which
--  runs first, and it is safe to run again when new migrations are added.
--  It is also safe to run over a database left half-built by a failed run.
-- ============================================================================
`;

const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const body = files.map((f) => readFileSync(join(dir, f), 'utf8').replace(/\n+$/, ''));
const out = `${header}\n${body.join('\n\n')}\n`;

writeFileSync(join(root, 'supabase', 'setup.sql'), out);
console.log(`setup.sql — ${files.length} migrations, ${out.split('\n').length - 1} lines`);

/* ── sync.sql: the same schema, with nothing that touches a row ─────────────
 *
 * Why a second file exists at all.
 *
 * A live database can be missing a migration and give no sign of it. One was:
 * 0036 had never been applied, so opening an event failed with a row level
 * security refusal for weeks, and nothing anywhere said which migration was
 * absent. The way out of that is to apply the whole schema again and let the
 * `if not exists` guards fill in whatever is missing — which now works,
 * because the history is re-runnable.
 *
 * setup.sql cannot be that file. It also carries the one-time data migrations:
 * statements that delete empty pending producers, demote a second super_admin,
 * fill in a blank brand name. Each is correct exactly once, on the day its
 * migration was written, and each is a change to somebody's data if it runs
 * again. On a database with real weddings in it that is not a risk worth
 * taking to fix a missing policy.
 *
 * So this file is every statement that describes the shape of the database and
 * none that changes what is in it. Running it can add a column, replace a
 * function, or restore a policy. It cannot delete a row, and that is a property
 * the test asserts rather than a claim made here.
 *
 * What counts as touching a row: a top-level INSERT, UPDATE or DELETE. The
 * same words inside a function body do not — that is the definition of the
 * function, not an execution of it — so the dollar-quoted bodies are tracked
 * and skipped over.
 */
function schemaOnly(sql) {
  const lines = sql.split('\n');
  const kept = [];
  let inBody = false;      // inside a $$ … $$ function body
  let skipping = false;    // dropping a top-level DML statement
  let dropped = 0;

  for (const line of lines) {
    /* Dollar quotes come in pairs on the same line often enough that counting
       them is the only reading that survives `as $$ select 1 $$;`. */
    const marks = (line.match(/\$\$/g) ?? []).length;

    if (!inBody && !skipping && /^\s*(insert\s+into|update|delete\s+from)\s/i.test(line)) {
      skipping = true;
      dropped++;
      kept.push(`-- [sync] one-time data migration removed: ${line.trim().slice(0, 60)}`);
    }

    if (skipping) {
      /* A statement ends at the semicolon that is not inside a string. Close
         enough here because none of these carry one. */
      if (/;\s*(--.*)?$/.test(line)) skipping = false;
      continue;
    }

    kept.push(line);
    if (marks % 2 === 1) inBody = !inBody;
  }

  return { text: kept.join('\n'), dropped };
}

const syncHeader = `-- ============================================================================
--  Liver productions - bring an existing database up to date
--
--  Paste this whole file into the Supabase SQL Editor and press Run.
--
--  It is every migration's SCHEMA, in order, and none of the one-time data
--  migrations. It can add a missing column, restore a policy that was never
--  applied, or replace a function with its current version. It cannot delete,
--  insert or update a single row.
--
--  Safe to run as often as you like. Use setup.sql instead only when building
--  a brand new database from nothing.
-- ============================================================================
`;

const sync = schemaOnly(body.join('\n\n'));
writeFileSync(join(root, 'supabase', 'sync.sql'), `${syncHeader}\n${sync.text}\n`);
console.log(`sync.sql   — same schema, ${sync.dropped} data statements removed`);
