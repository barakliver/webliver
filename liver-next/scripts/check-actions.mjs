/**
 * A write that fails does not fail quietly.
 *
 *     node scripts/check-actions.mjs
 *
 * There are a hundred and twenty four server actions in this product. Most
 * return a result and the screen says what happened. Sixteen returned nothing
 * at all: they logged the failure, revalidated, and the screen redrew exactly
 * as it had been — so pressing revoke on a signing link that would not revoke
 * left the link listed, which reads as "the button did not register my click"
 * rather than as "that link is still live".
 *
 * The failure mode is the same one as an empty list that is really a broken
 * query: the output of the failure is indistinguishable from the output of
 * success, so nobody reports it and everybody believes it.
 *
 * Two rules, because there were two shapes of the same bug. An action that
 * returns nothing and *knows* a write failed has to leave a sentence behind
 * with `noteFailure`. And an action that returns nothing and writes has to
 * look at the error at all — thirty five of them did not, which is the same
 * failure one step worse: `togglePaid` marked a payment as paid, the write was
 * refused, and nothing anywhere recorded it, on the screen or in the log.
 *
 * An action that returns a result is already answering its caller and is left
 * alone.
 *
 * A third rule, for the same bug wearing the opposite face: a write that
 * *succeeded* and that the screen never heard about. The supplier form marked
 * a task done straight from the browser and then closed itself, so the task
 * was finished in the database and open on the screen — and a couple pressing
 * the circle again got the same form again. The tick has one writer,
 * `toggleTask`, because that is the one that also revalidates the couple's
 * screen, the producer's and the overview, and that takes the supplier back
 * when a tick comes off. So no component may write a task's `done` itself.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/app/actions');

/* Deliberately quiet, with the reason. These fire on their own when a screen
   opens rather than because somebody pressed something, so a red line about a
   read receipt is a worse screen than a receipt that quietly did not stick.
   They still log. */
const QUIET = {
  'messages.ts markThreadRead': 'marks a thread read on open; nobody asked for it',
  'notifications.ts markRead': 'marks one notice read on open; nobody asked for it',
  'notifications.ts markAllRead': 'the same, for all of them at once',
};

let checked = 0;
const silent = [];
const blind = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const src = readFileSync(join(dir, file), 'utf8');

  for (const m of src.matchAll(/export async function (\w+)\([^)]*\)\s*:\s*Promise<void>/g)) {
    const from = m.index + m[0].length;
    const next = src.indexOf('\nexport ', from);
    const body = src.slice(from, next === -1 ? src.length : next);
    checked += 1;
    /* "Knows a write failed" is spelled `console.error` everywhere in this
       codebase, which is what makes this checkable at all. */
    const key = `${file} ${m[1]}`;
    if (body.includes('console.error') && !body.includes('noteFailure') && !(key in QUIET)) {
      silent.push(`${file}  ${m[1]}`);
    }
    /* The worse shape: it writes and never destructures an error, so a refusal
       is indistinguishable from success everywhere, including the log. */
    if (/\.(delete|insert|update|upsert|rpc)\(/.test(body) && !body.includes('error')) {
      blind.push(`${file}  ${m[1]}`);
    }
  }
}

/* ── the tick has one writer ────────────────────────────────────────────────
   Every component under src, so a second supplier form in a year's time is
   caught the same way. The action file itself is the writer and is skipped. */
const ticked = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.tsx?$/.test(p) || p.startsWith(dir)) continue;
    const src = readFileSync(p, 'utf8');
    /* A write of `done` on the tasks table, however the call is spread over
       lines: `.from('tasks')` and then `.update({ ... done ... })`. */
    for (const m of src.matchAll(/from\(['"]tasks['"]\)[\s\S]{0,120}?\.update\(\s*\{([^}]*)\}/g)) {
      if (/\bdone\b/.test(m[1])) ticked.push(relative(root, p));
    }
  }
};
walk(join(root, 'src'));

for (const s of blind) console.log(`  never looks    src/app/actions/${s}`);
for (const s of silent) console.log(`  says nothing   src/app/actions/${s}`);
for (const s of new Set(ticked)) console.log(`  ticks alone    ${s}`);

/* A reason that has outlived its action is a reason nobody will delete. */
const stale = Object.keys(QUIET).filter((k) => {
  const [f, n] = k.split(' ');
  try { return !readFileSync(join(dir, f), 'utf8').includes(`function ${n}(`); }
  catch { return true; }
});
for (const k of stale) console.log(`  gone           ${k} is excused here and no longer exists`);

const bad = silent.length + blind.length + stale.length + ticked.length;
if (bad === 0) {
  console.log(`\na failed write is never silent  (${checked} actions that return nothing, ${Object.keys(QUIET).length} quiet on purpose)`);
  console.log('a task is ticked through toggleTask and nowhere else\n');
} else {
  console.log('\nCapture the error, log it, and add `await noteFailure(...)` from @/lib/flash —');
  console.log('or give the action a return type so its own screen can answer.');
  console.log('If it fires on its own and a banner would be noise, add it to QUIET with a reason.');
  console.log('A tick goes through toggleTask from @/app/actions/tasks, which revalidates the');
  console.log('screens it changed; a write from the browser leaves the circle as it was.\n');
}
process.exit(bad === 0 ? 0 : 1);
