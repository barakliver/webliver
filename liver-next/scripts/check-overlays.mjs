/**
 * Everything that opens over the page can be closed, and gives the keyboard
 * back.
 *
 *     node scripts/check-overlays.mjs
 *
 * `check-a11y.mjs` prints this in its own list of things it cannot test:
 * "close a dialog: focus returns to the control that opened it". axe reads a
 * tree and that is a sequence, so no automated pass in this project was ever
 * going to see it. It was measured by hand instead, and of the thirteen
 * things here that put `role="dialog"` over the screen, six returned focus to
 * nothing and two had no keyboard exit at all. The accessibility menu was one
 * of the six, under a comment that said it returned focus.
 *
 * None of it was visible on a screen. All of it is one hook now, and this is
 * the line that keeps the fourteenth from being written without it.
 *
 * The rule is `useOverlay`, not "something that looks like focus handling".
 * A grep for `activeElement` would pass a component that reads it and throws
 * it away, which is most of how these went wrong in the first place.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');

/* Panels that still carry their own copy of the behaviour, written before
   the hook existed and verified by hand to do all four. The list is the
   honest form of "not yet" rather than a hole: it is short, it is named, and
   it is meant to shrink. Nothing may be added to it - a new overlay uses the
   hook. */
const THEIR_OWN = new Set([
  'src/components/ChatDock.tsx',
  'src/components/app/DayOfCockpit.tsx',
  'src/components/app/QuickJump.tsx',
  'src/components/marketing/FabDock.tsx',
  'src/components/portal/PortalJump.tsx',
]);

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const OPENS_OVER = /role=["']dialog["']|aria-modal/;

const naked = [];
let held = 0;
let byHand = 0;

for (const f of walk(SRC)) {
  const rel = relative(root, f);
  const src = stripComments(readFileSync(f, 'utf8'));
  if (!OPENS_OVER.test(src)) continue;
  if (/\buseOverlay\s*\(/.test(src)) { held += 1; continue; }
  if (THEIR_OWN.has(rel)) { byHand += 1; continue; }
  naked.push(rel);
}

/* A name on the list that no longer opens anything is the other way this
   rots: the exemption outlives the reason for it. */
const stale = [...THEIR_OWN].filter((rel) => {
  try { return !OPENS_OVER.test(stripComments(readFileSync(join(root, rel), 'utf8'))); }
  catch { return true; }
});

if (naked.length > 0 || stale.length > 0) {
  for (const p of naked) {
    console.error(`\n  ${p} opens over the page and does not use useOverlay.`);
  }
  for (const p of stale) {
    console.error(`\n  ${p} is listed as having its own and no longer opens anything.`);
  }
  console.error('\nEscape closes it, focus moves in and goes back to whatever opened it,');
  console.error('the page behind holds still, and Back closes the panel rather than the');
  console.error('screen. All four are `useOverlay` in src/lib/useOverlay.ts.\n');
  process.exit(1);
}

console.log(
  `\neverything that opens over the page gives the keyboard back  (${held} through the hook, ${byHand} with their own)\n`,
);
