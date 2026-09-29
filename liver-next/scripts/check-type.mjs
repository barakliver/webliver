/**
 * Is every size in the product on the scale?
 *
 *     node scripts/check-type.mjs
 *
 * This exists because of how the last thirty-five sizes got here. Nobody
 * chose thirty-five. Each one was a reasonable local decision — this line
 * wants to be a touch smaller than that one — written by somebody looking at
 * one panel, and half a pixel is invisible in one panel. Across a product it
 * is the whole difference between a screen that reads as designed and a
 * screen that reads as assembled, and it is unpointable: nobody can say what
 * is wrong, only that something is.
 *
 * So the scale is enforced rather than agreed. `npm run classes` does exactly
 * this for colour, for exactly the same reason, and the two failures are the
 * same shape: a mistake that looks like a decision.
 *
 * What is allowed:
 *
 *   the eight named steps in tailwind.config.ts, and the display sizes
 *   already named there — display, display-xl, title, metric, metric-sm
 *
 *   an arbitrary value of 30px or more. Those are one-off art directions —
 *   the countdown, the game's own type, the marketing hero — and there are
 *   nine of them. A hero is designed once, at a size chosen by eye against
 *   its own photograph, and putting it on a shared step buys nothing.
 *
 * Everything below 30px is interface, and interface is a system.
 *
 * The threshold is deliberately not zero-tolerance. A check that forbids
 * every arbitrary value forces somebody building a hero to add a ninth step
 * nothing else will ever use, which grows the scale to defeat the check.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

/** Below this, a size must be a named step. At or above it, a one-off is
 *  what a hero actually is. */
const DISPLAY_FLOOR = 30;

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (/\.(tsx?|css)$/.test(entry)) files.push(full);
  }
})(src);

const pattern = /text-\[(\d+(?:\.\d+)?)px\]/g;
const offences = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(pattern)) {
      const px = Number(m[1]);
      if (px >= DISPLAY_FLOOR) continue;
      offences.push({ file: relative(root, file), line: i + 1, px, text: m[0] });
    }
  });
}

/* Read the steps out of the config rather than repeating them, so the
   message names the real choices and cannot go stale. */
const { default: config } = await import('../tailwind.config.ts');
const steps = Object.entries(config.theme.extend.fontSize)
  .filter(([, v]) => typeof v === 'string')
  .map(([name, v]) => `text-${name} (${v})`)
  .join(', ');

if (offences.length) {
  console.error(`\n${offences.length} size${offences.length === 1 ? '' : 's'} off the scale:\n`);
  for (const o of offences) {
    console.error(`  ${o.file}:${o.line}  ${o.text}`);
  }
  console.error(`\nUse a step: ${steps}`);
  console.error(`An arbitrary value is allowed at ${DISPLAY_FLOOR}px and up, where it is a one-off by nature.\n`);
  process.exit(1);
}

const oneOffs = new Set();
for (const file of files) {
  for (const m of readFileSync(file, 'utf8').matchAll(pattern)) oneOffs.add(m[1]);
}

console.log(`\nevery interface size is on the scale  (8 steps, ${oneOffs.size} display one-offs at ${DISPLAY_FLOOR}px and up)\n`);
