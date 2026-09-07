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
