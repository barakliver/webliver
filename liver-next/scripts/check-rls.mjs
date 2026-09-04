/**
 * Is every table actually fenced, and by what?
 *
 *     node scripts/check-rls.mjs
 *
 * This product holds other people's weddings: guest lists, phone numbers,
 * what a couple pays each supplier, and private notes a producer writes about
 * both. All of it is separated by row level security and nothing else — there
 * is no per-request producer filter in the queries, deliberately, because a
 * filter somebody forgets to write is a filter that leaks. A hidden menu item
 * is not permission control, and neither is a `.eq('producer_id', …)` that
 * exists on nineteen screens and is missing from the twentieth.
 *
 * Which makes one mistake catastrophic and invisible: a table created without
 * `enable row level security`, or with it and no policy. The first is readable
 * by anyone with the publishable key, which is in every browser that has ever
 * loaded the site. The second is readable by nobody, which at least fails
 * loudly. This refuses both.
 *
 * The check that follows is the one worth having beyond that: a policy open to
 * `anon` on a table holding event data. Three tables are deliberately public
 * and say so by name; anything else joining them is a leak with a migration
 * behind it, which is not a thing to discover from a screenshot.
 *
 * Read only. It parses the migrations; it does not connect to anything.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'supabase', 'migrations');

/**
 * Tables a stranger is supposed to reach, each with the reason.
 *
 * Listed rather than inferred. A public table is a decision, and the only way
 * to keep it a decision is to make adding one require editing this list.
 */
const PUBLIC_BY_DESIGN = {
  site_content: 'the marketing copy, which is the public site',
  site_settings: 'which producer owns the public site',
  products: 'the shop, and its policy shows a stranger only what is switched on',
};

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');

/* Comments out, so a table named in an explanation is not mistaken for one
   that exists, and a policy shown as an example is not counted as shipped. */
const code = sql
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*--.*$/gm, ' ');

const created = new Set();
for (const m of code.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi)) {
  created.add(m[1]);
}

const guarded = new Set();
for (const m of code.matchAll(/alter\s+table\s+public\.([a-z_]+)\s+enable\s+row\s+level\s+security/gi)) {
  guarded.add(m[1]);
}

/* `on public.x` is how every policy in this schema names its table. */
const policied = new Map();
for (const m of code.matchAll(/create\s+policy\s+[^\n]*?\s+on\s+public\.([a-z_]+)/gi)) {
  policied.set(m[1], (policied.get(m[1]) ?? 0) + 1);
}

const problems = [];
const notes = [];

for (const table of [...created].sort()) {
  if (!guarded.has(table)) {
    problems.push([table, 'has no row level security at all — readable by anyone holding the publishable key']);
    continue;
  }
  if (!policied.has(table)) {
    problems.push([table, 'has row level security and no policy, so nothing can read it, including this app']);
  }
}

/**
 * A policy that lets a stranger in.
 *
 * Two shapes count: one that names `anon` or `public` outright, and one that
 * restricts nothing — `using (true)` with no role at all, which reads as
 * harmless and means everybody. `using (true) to authenticated` is neither;
 * it is the normal way to say "anyone signed in", and an earlier version of
 * this file called it a leak, which is the kind of false alarm that gets a
 * checker switched off.
 *
 * Policies are folded by name first. A migration that drops a policy and
 * creates it again is the only way this schema changes one, so reading every
 * definition ever written reports a state that was fixed three migrations
 * ago. The last definition of a name is the live one.
 */
const live = new Map();
for (const m of code.matchAll(/create\s+policy\s+([a-z0-9_]+)\s+on\s+public\.([a-z_]+)([\s\S]*?);/gi)) {
  const [, name, table, body] = m;
  live.set(`${table}.${name}`, { name, table, body });
}

for (const { name, table, body } of live.values()) {
  const named = /\bto\s+(anon|public)\b/i.test(body);
  const unrestricted = /using\s*\(\s*true\s*\)/i.test(body) && !/\bto\s+[a-z_]+/i.test(body);
  if (!named && !unrestricted) continue;
  if (table in PUBLIC_BY_DESIGN) {
    notes.push([table, PUBLIC_BY_DESIGN[table]]);
    continue;
  }
  problems.push([table, `policy ${name} is open to strangers, and this table is not on the public list`]);
}

const width = Math.max(20, ...[...created].map((t) => t.length));
console.log(`\n${created.size} tables, ${guarded.size} fenced, ${[...policied.values()].reduce((a, b) => a + b, 0)} policies\n`);

if (notes.length > 0) {
  const seen = new Set();
  for (const [table, why] of notes) {
    if (seen.has(table)) continue;
    seen.add(table);
    console.log(`  public  ${table.padEnd(width)}  ${why}`);
  }
  console.log('');
}

if (problems.length === 0) {
  const open = new Set(notes.map(([t]) => t)).size;
  console.log(`every table is fenced, and ${open} of them ${open === 1 ? 'is' : 'are'} open on purpose\n`);
  process.exit(0);
}

for (const [table, why] of problems) console.error(`  FAIL  ${table.padEnd(width)}  ${why}`);
console.error('\nA table here holds somebody\'s wedding. If it is meant to be public,');
console.error('add it to PUBLIC_BY_DESIGN in this file with the reason, so the next');
console.error('person reads a decision rather than an omission.\n');
process.exit(1);
