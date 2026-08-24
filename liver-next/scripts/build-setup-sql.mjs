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
