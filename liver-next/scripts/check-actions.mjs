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
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

for (const s of blind) console.log(`  never looks    src/app/actions/${s}`);
for (const s of silent) console.log(`  says nothing   src/app/actions/${s}`);

/* A reason that has outlived its action is a reason nobody will delete. */
const stale = Object.keys(QUIET).filter((k) => {
  const [f, n] = k.split(' ');
  try { return !readFileSync(join(dir, f), 'utf8').includes(`function ${n}(`); }
  catch { return true; }
});
for (const k of stale) console.log(`  gone           ${k} is excused here and no longer exists`);

if (silent.length + blind.length + stale.length === 0) {
  console.log(`\na failed write is never silent  (${checked} actions that return nothing, ${Object.keys(QUIET).length} quiet on purpose)\n`);
} else {
  console.log('\nCapture the error, log it, and add `await noteFailure(...)` from @/lib/flash —');
  console.log('or give the action a return type so its own screen can answer.');
  console.log('If it fires on its own and a banner would be noise, add it to QUIET with a reason.\n');
}
process.exit(silent.length + blind.length + stale.length === 0 ? 0 : 1);
