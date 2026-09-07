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
 * The rule: an action that returns nothing, and that knows a write failed, has
 * to leave a sentence behind with `noteFailure`. An action that returns a
 * result is already answering its caller and is left alone.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/app/actions');

let checked = 0;
const silent = [];

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
    if (body.includes('console.error') && !body.includes('noteFailure')) {
      silent.push(`${file}  ${m[1]}`);
    }
  }
}

for (const s of silent) console.log(`  says nothing   src/app/actions/${s}`);

if (silent.length === 0) {
  console.log(`\na failed write always leaves a sentence  (${checked} actions that return nothing)\n`);
} else {
  console.log('\nAdd `await noteFailure(...)` from @/lib/flash beside the console.error,');
  console.log('or give the action a return type so its own screen can answer.\n');
}
process.exit(silent.length === 0 ? 0 : 1);
