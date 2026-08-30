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

/* Function heads, with the body that belongs to each one.
 *
 * Bounded by the dollar quote that opens and closes the body, not by the next
 * function head. Running to the next head swallows every statement in between
 * — a DO block, a trigger, a plain query — and attributes all of it to the
 * function above, which is how a check that reads `pg_class c` in one place
 * accuses `public.clients` of missing a column in another. */
function bodies(sql) {
  const head = /create\s+or\s+replace\s+function\s+([a-z0-9_.]+)\s*\(/gi;
  const out = [];
  let m;

  while ((m = head.exec(sql)) !== null) {
    const rest = sql.slice(m.index);
    /* The tag is whatever sits between the `as` and the body: `$$` usually,
       sometimes `$fn$`. Whatever it is, the body ends at the next copy of it. */
    const open = /\bas\s+(\$[a-z0-9_]*\$)/i.exec(rest);
    let text;

    if (open) {
      const from = open.index + open[0].length;
      const close = rest.indexOf(open[1], from);
      text = rest.slice(0, close === -1 ? rest.length : close + open[1].length);
    } else {
      /* No dollar quote found: fall back to the old behaviour rather than
         skipping the function, so a shape this does not recognise is still
         checked by the rules that do not need a boundary. */
      text = rest.slice(0, 4000);
    }

    out.push({ name: m[1], at: m.index, line: sql.slice(0, m.index).split('\n').length, text });
  }
  return out;
}

/* pgcrypto lives in `extensions` on Supabase and in `public` on a plain
   PostgreSQL install. A function that pins `search_path = public` and calls one
   of its functions creates cleanly — plpgsql resolves names when it runs — and
   then fails on the first click. It has now done that twice in this codebase. */
const PGCRYPTO = /\b(gen_random_bytes|digest|hmac|crypt|gen_salt|pgp_sym_\w+)\s*\(/;

/* Every column every table has ever been given, gathered from the migrations
   themselves rather than from a live database — so this runs on a laptop with
   no connection, which is the only way a check like this gets run at all.
   Both shapes count: the columns in a CREATE TABLE, and the ones bolted on
   later by ALTER TABLE ADD COLUMN. */
function schema() {
  const cols = new Map();
  const add = (table, col) => {
    if (!cols.has(table)) cols.set(table, new Set());
    cols.get(table).add(col);
  };

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');

    const create = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)\s*\(([\s\S]*?)\n\)\s*;/gi;
    let m;
    while ((m = create.exec(sql)) !== null) {
      for (const raw of m[2].split('\n')) {
        const line = raw.trim();
        /* A column definition opens with a bare identifier. Constraints,
           indexes and comments all open with a keyword, so skipping those
           four words is the whole of the parse. */
        const col = /^([a-z0-9_]+)\s+[a-z]/i.exec(line);
        if (col && !/^(constraint|primary|unique|check|foreign|exclude|like)$/i.test(col[1])) {
          add(m[1], col[1].toLowerCase());
        }
      }
    }

    /* One ALTER can add several columns in a single statement, comma
       separated. Matching only the first is how `sign_token` looked missing
       while sitting four lines under `party_name` in the same statement. */
    const alter = /alter\s+table\s+(?:only\s+)?public\.([a-z0-9_]+)([\s\S]*?);/gi;
    while ((m = alter.exec(sql)) !== null) {
      const each = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi;
      let one;
      while ((one = each.exec(m[2])) !== null) add(m[1], one[1].toLowerCase());
    }
  }
  return cols;
}

const COLUMNS = schema();

/* Tables this cannot know about: another schema's, or one made on the fly. */
const OFF_LIMITS = /^(storage|auth|extensions|pg_|information_schema)/;

/**
 * A body that names a column the table does not have.
 *
 * The third bug of this exact shape in this codebase, and the most expensive:
 * a plpgsql body resolves its column names when it *runs*, so a function that
 * sums `budget_items.amount` — a column that has never existed, the table
 * carries `estimate` and `agreed` — is created without a murmur and fails the
 * first time somebody presses the button it sits behind. The migration reports
 * success, and the failure surfaces days later somewhere else entirely.
 *
 * Only the `from public.<table> <alias>` shape is checked, because that is the
 * one where the alias is unambiguous. A join, a CTE or a bare table name is
 * left alone: a checker that guesses is a checker that gets switched off.
 */
function unknownColumns(text) {
  const bad = [];
  const from = /\bfrom\s+public\.([a-z0-9_]+)\s+(?:as\s+)?([a-z][a-z0-9_]*)\b/gi;
  let m;

  while ((m = from.exec(text)) !== null) {
    const [, table, alias] = m;
    if (OFF_LIMITS.test(table)) continue;

    const known = COLUMNS.get(table.toLowerCase());
    if (!known) continue;

    /* Aliases that are really keywords are not aliases. */
    if (/^(where|join|left|right|inner|outer|on|order|group|having|limit|union|cross|full|natural|using|window|for|loop)$/i.test(alias)) continue;

    const use = new RegExp(`\\b${alias}\\.([a-z0-9_]+)`, 'gi');
    let u;
    while ((u = use.exec(text)) !== null) {
      const col = u[1].toLowerCase();
      if (!known.has(col) && !bad.some((b) => b.table === table && b.col === col)) {
        bad.push({ table, col, alias });
      }
    }
  }
  return bad;
}

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

    for (const b of unknownColumns(fn.text)) {
      complain(file, fn.line,
        `${fn.name} reads ${b.alias}.${b.col}, but public.${b.table} has no such column. ` +
        'A plpgsql body resolves column names when it runs, so this creates cleanly ' +
        'and fails the first time the function is called.');
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
