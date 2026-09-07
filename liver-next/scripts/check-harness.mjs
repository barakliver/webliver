/**
 * Every component that draws something can be looked at.
 *
 *     node scripts/check-harness.mjs
 *
 * `/design` mounts the product's components against fixtures, with no
 * database and nobody's real wedding, and it is the only place any of them
 * get looked at. That mattered more than it sounds: rendering has caught a
 * face with no photograph breaking a row, a category select labelled with its
 * own panel's title, two fixtures that lied about a not-null column, and a
 * `git checkout` that silently deleted a component TypeScript was perfectly
 * happy about.
 *
 * Every one of those was in something somebody had thought to add. When this
 * check was written, a third of the components were not in the harness at
 * all, and nothing anywhere said so — so the ones nobody thought to add were
 * exactly the ones nobody could see. The sign-in code's boxes had been
 * drawing a bowl instead of a rule under each digit for as long as they have
 * existed, and the cause turned out to be a base stylesheet rule that had
 * quietly switched off the focus ring on every field in the product.
 *
 * So the rule is mechanical: a file under `src/components` is in the harness,
 * or it is named below with a reason. The list is short on purpose. "It is
 * hard to render" is not a reason — that is usually the component that most
 * needs looking at, and the answer is to split the part that draws from the
 * part that fetches, which is what happened to LoadTrouble.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = join(root, 'src/app/design/page.tsx');

/* Not panels. Each line is the reason, and each reason is about the component
   rather than about the effort of writing a fixture. */
const NOT_DRAWN = {
  'app/ServiceWorker': 'registers the worker and renders nothing at all',
  'app/Live': 'a connection indicator; it has no appearance without a live socket',
  'app/VersionWatch': 'polls for a newer build; what it draws is the reload prompt, which is the notice panel',
  'app/LinkHint': 'the spinner inside a link, so it is on every link in the harness already',
  'app/AppNav': 'the shell around the harness, so every screenshot of it already contains it',
  'app/Sheet': 'a container with no content of its own; it is looked at through PortalActions, which opens two',
  'app/Sortable': 'a drag behaviour that wraps rows; the rows it wraps are in the run sheet and the seating plan',
  'app/DragOnto': 'the other half of that behaviour, and a drop target draws nothing until something is dragged',
  ChatDock: 'the chat shell itself, looked at through both assistants that mount it',
};

const files = [];
for (const dir of ['src/components/app', 'src/components']) {
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith('.tsx')) continue;
    files.push(dir.endsWith('/app') ? `app/${name.slice(0, -4)}` : name.slice(0, -4));
  }
}

const harness = readFileSync(HARNESS, 'utf8');
const imported = new Set([...harness.matchAll(/from '@\/components\/([A-Za-z0-9_/]+)'/g)].map((m) => m[1]));

const unseen = files.filter((f) => !imported.has(f) && !(f in NOT_DRAWN));
/* A reason that has outlived its component is a reason nobody will delete. */
const stale = Object.keys(NOT_DRAWN).filter((f) => !files.includes(f));
const contradicted = Object.keys(NOT_DRAWN).filter((f) => imported.has(f));

for (const f of unseen) {
  console.log(`  never looked at   src/components/${f}.tsx`);
}
for (const f of stale) {
  console.log(`  gone              ${f} is excused in check-harness.mjs and no longer exists`);
}
for (const f of contradicted) {
  console.log(`  excused anyway    ${f} is in the harness; drop its line from NOT_DRAWN`);
}

const failures = unseen.length + stale.length + contradicted.length;
if (failures === 0) {
  console.log(`\nevery component can be looked at  (${imported.size} in the harness, ${Object.keys(NOT_DRAWN).length} that draw nothing)\n`);
} else {
  console.log(`\nAdd a panel to src/app/design/page.tsx, or a reason to NOT_DRAWN in this file.`);
  console.log(`A panel is nearly always the right answer: the ones nobody adds are the ones nobody sees.\n`);
}
process.exit(failures === 0 ? 0 : 1);
