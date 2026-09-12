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
import { join, dirname, relative, sep } from 'node:path';
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
  ThemeScope: 'puts the palette back in step on every navigation and renders nothing; what it does is visible as the whole page, not as a panel',
  'brand/Pieces': 'the seven printed pieces, drawn fourteen times inside the BrandStudio panel and never on their own',
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

/* Drawn on a public route rather than in the harness.
 *
 * The marketing site's pieces, the floating accessibility button and the
 * guests' find-me form are looked at by pointing a browser at the route
 * that draws them, not through a fixture; a hero with a photograph and a
 * scroll effect is meaningless in a 1280px panel. Each line names the
 * route, and each component is verified to be imported somewhere under
 * src — so a line here cannot outlive its component, and a component
 * nobody imports any more shows up as unseen rather than hiding behind a
 * route it is not on. Nothing may be added here that a panel could hold. */
const DRAWN_ON_ROUTE = {
  'a11y/A11yPanel': 'every page: the floating accessibility button',
  'guest/FindInvite': "/w/[token], the guests' site",
  'marketing/AiConcierge': '/ and /app/guide',
  'marketing/AmbientBackdrop': '/, inside the hero',
  'marketing/BeginPath': '/',
  'marketing/BookMeeting': '/',
  'marketing/BudgetSimulator': '/',
  'marketing/DarkBand': '/ and /eventos',
  'marketing/FabDock': '/',
  'marketing/Hero': '/',
  'marketing/LangToggle': 'every page: the top bar',
  'marketing/LeadForm': '/',
  'marketing/Nav': '/, /eventos and /store',
  'marketing/Parallax': '/, inside the hero',
  'marketing/PhoneStage': '/',
  'marketing/Portfolio': '/',
  'marketing/Portrait': '/',
  'marketing/Prose': '/',
  'marketing/Section': '/, /eventos and /store',
  'marketing/SiteFooter': '/, /eventos and /store',
  'marketing/Steps': '/',
  'marketing/StructuredData': '/, as JSON-LD in the head',
};

/* Every import of a component anywhere under src, so "drawn on a route"
   can be checked rather than believed. Both spellings count: the alias a
   page uses (`@/components/marketing/Hero`) and the relative one a
   neighbour uses (`./Parallax` from inside the hero). */
const srcImports = new Set();
const walkSrc = (dir) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) walkSrc(join(dir, entry.name));
    else if (/\.(tsx?|mjs)$/.test(entry.name)) {
      const text = readFileSync(join(root, dir, entry.name), 'utf8');
      for (const m of text.matchAll(/from '([^']+)'/g)) {
        const spec = m[1];
        const resolved = spec.startsWith('@/components/')
          ? spec.slice('@/components/'.length)
          : spec.startsWith('.')
            ? relative(join(root, 'src', 'components'), join(root, dir, spec))
            : null;
        if (resolved && !resolved.startsWith('..')) srcImports.add(resolved.split(sep).join('/'));
      }
    }
  }
};
walkSrc('src');

const unseen = files.filter((f) => !imported.has(f) && !(f in NOT_DRAWN) && !(f in DRAWN_ON_ROUTE));
/* A route line for a component nobody imports, or that no longer exists. */
const unrouted = Object.keys(DRAWN_ON_ROUTE).filter((f) => !files.includes(f) || !srcImports.has(f));
/* A reason that has outlived its component is a reason nobody will delete. */
const stale = Object.keys(NOT_DRAWN).filter((f) => !files.includes(f));
const contradicted = Object.keys(NOT_DRAWN).filter((f) => imported.has(f));

for (const f of unseen) console.log(`  never looked at   src/components/${f}.tsx`);
for (const f of stale) console.log(`  stale reason      ${f} is in NOT_DRAWN and no longer exists`);
for (const f of contradicted) console.log(`  excused anyway    ${f} is in the harness; drop its line from NOT_DRAWN`);
for (const f of unrouted) console.log(`  not on its route  ${f} is in DRAWN_ON_ROUTE and nothing imports it`);

const failures = unseen.length + stale.length + contradicted.length + unrouted.length;
if (failures === 0) {
  console.log(`\nevery component can be looked at  (${imported.size} in the harness, ${Object.keys(NOT_DRAWN).length} that draw nothing, ${Object.keys(DRAWN_ON_ROUTE).length} on public routes)\n`);
} else {
  console.log(`\nAdd a panel to src/app/design/page.tsx, or a reason to NOT_DRAWN in this file.`);
  console.log(`A panel is nearly always the right answer: the ones nobody adds are the ones nobody sees.\n`);
}
process.exit(failures === 0 ? 0 : 1);
