/**
 * The mistakes a migration makes silently.
 *
 *     node scripts/check-sql.mjs
 *
 * Every rule here comes from a bug that actually shipped, and every one of them
 * shares a shape: the migration applies without complaint and fails later, at a
 * moment nobody connects back to the SQL.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

let failed = 0;
const complain = (file, line, what) => {
  failed += 1;
  console.log(`FAIL  ${file}:${line}\n      ${what}`);
};

/* Function heads, with the body that follows each one. A migration is a flat
   file, so the body of a function is everything up to the next `create ...
   function` or the end. */
function bodies(sql) {
  const head = /create\s+or\s+replace\s+function\s+([a-z0-9_.]+)\s*\(/gi;
  const found = [];
  let m;
  while ((m = head.exec(sql)) !== null) found.push({ name: m[1], at: m.index });
  return found.map((f, i) => ({
    ...f,
    line: sql.slice(0, f.at).split('\n').length,
    text: sql.slice(f.at, i + 1 < found.length ? found[i + 1].at : sql.length),
  }));
}

/* pgcrypto lives in `extensions` on Supabase and in `public` on a plain
   PostgreSQL install. A function that pins `search_path = public` and calls one
   of its functions creates cleanly — plpgsql resolves names when it runs — and
   then fails on the first click. It has now done that twice in this codebase. */
const PGCRYPTO = /\b(gen_random_bytes|digest|hmac|crypt|gen_salt|pgp_sym_\w+)\s*\(/;

for (const file of files) {
  const sql = readFileSync(join(dir, file), 'utf8');

  for (const fn of bodies(sql)) {
    const path = /set\s+search_path\s*=\s*([a-z0-9_,\s]+?)\s+as\b/i.exec(fn.text);
    const usesPgcrypto = PGCRYPTO.test(fn.text);

    if (usesPgcrypto && path && !/extensions/.test(path[1])) {
      complain(file, fn.line,
        `${fn.name} calls pgcrypto but pins search_path to "${path[1].trim()}". ` +
        'pgcrypto is in `extensions` on Supabase, so this creates cleanly and fails when called. ' +
        'Write: set search_path = public, extensions');
    }

    /* A definer function with no search_path at all runs with whatever the
       caller has, which is a different function depending on who calls it. */
    if (/security\s+definer/i.test(fn.text) && !path) {
      complain(file, fn.line,
        `${fn.name} is security definer with no search_path. ` +
        'It then resolves names against whatever the caller happens to have set.');
    }
  }
}

console.log(failed === 0
  ? `\nevery migration is sound  (${files.length} files read)`
  : `\n${failed} problem${failed === 1 ? '' : 's'} above`);
process.exit(failed === 0 ? 0 : 1);
