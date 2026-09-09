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
/* The gallery is the whole directory, not just the page.
   A component that needs client-side handlers cannot be mounted straight from
   page.tsx, because it is a server component and a function cannot cross that
   line — so it gets a small 'use client' wrapper beside it, and the component
   is then imported there rather than in the page. Reading only the page missed
   those, and reported a component as never looked at while it was on screen. */
const HARNESS_DIR = join(root, 'src/app/design');

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
  'app/FlashClear': 'deletes the message once it has been seen and renders nothing',
};

/* Every directory under components, however deep, found rather than listed.
 *
 * This named `src/components/app` and `src/components` outright, which was
 * every directory there was on the day it was written. `src/components/portal`
 * was added later, and the two components in it — the event selector and the
 * form that catches a supplier when a task is ticked — were never scanned, so
 * a check whose entire purpose is to notice components nobody looks at did not
 * notice them. It reported 88 components and passed.
 *
 * A list of directories is a thing somebody has to remember to update, and the
 * one time it is not updated is the time a new directory appears — which is
 * exactly when a component is newest and least looked at. Walking finds them. */
const files = [];
const walk = (dir, prefix = '') => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
    else if (entry.name.endsWith('.tsx')) files.push(`${prefix}${entry.name.slice(0, -4)}`);
  }
};
walk('src/components');

const harness = readdirSync(HARNESS_DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => readFileSync(join(HARNESS_DIR, f), 'utf8'))
  .join('\n');
const imported = new Set([...harness.matchAll(/from '@\/components\/([A-Za-z0-9_/]+)'/g)].map((m) => m[1]));

/* Components the directory bug hid, which drew nothing for anybody to see.
 *
 * These are not excused. Every one of them draws something and every one of
 * them wants a panel; they are here because making the scan honest surfaced
 * twenty-three of them in one go, and twenty-three fixtures written in a hurry
 * to turn a check green is how a check stops meaning anything.
 *
 * The rule this buys: the gap cannot grow. A component added from here on has
 * to be in the harness, because it will not be in this list and nothing may be
 * added to it. The list only ever gets shorter, and the count below is printed
 * every run so it is not somewhere quiet. */
const BACKLOG = new Set([
  'a11y/A11yPanel', 'guest/FindInvite',
  'marketing/AiConcierge', 'marketing/AmbientBackdrop', 'marketing/BeginPath',
  'marketing/BookMeeting', 'marketing/BudgetSimulator', 'marketing/DarkBand',
  'marketing/FabDock', 'marketing/Hero', 'marketing/Journey', 'marketing/LangToggle',
  'marketing/LeadForm', 'marketing/Nav', 'marketing/Parallax', 'marketing/PhoneStage',
  'marketing/Portfolio', 'marketing/Portrait', 'marketing/Prose', 'marketing/Section',
  'marketing/SiteFooter', 'marketing/Steps', 'marketing/StructuredData',
]);

const unseen = files.filter((f) => !imported.has(f) && !(f in NOT_DRAWN) && !BACKLOG.has(f));
/* A backlog line that has been dealt with is a line to delete, same as a
   reason that has outlived its component. */
const settled = [...BACKLOG].filter((f) => imported.has(f) || !files.includes(f));
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

for (const f of settled) {
  console.log(`  done              ${f} is in the harness now; drop its line from BACKLOG`);
}

const waiting = [...BACKLOG].filter((f) => !settled.includes(f));
const failures = unseen.length + stale.length + contradicted.length + settled.length;
if (failures === 0) {
  console.log(`\nevery component can be looked at  (${imported.size} in the harness, ${Object.keys(NOT_DRAWN).length} that draw nothing)`);
  if (waiting.length > 0) {
    console.log(`${waiting.length} still waiting for a panel, from before the scan walked every directory:`);
    console.log(`  ${waiting.join(', ')}\n`);
  } else {
    console.log('');
  }
} else {
  console.log(`\nAdd a panel to src/app/design/page.tsx, or a reason to NOT_DRAWN in this file.`);
  console.log(`A panel is nearly always the right answer: the ones nobody adds are the ones nobody sees.\n`);
}
process.exit(failures === 0 ? 0 : 1);
