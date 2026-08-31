/**
 * Will this number survive being read right to left?
 *
 *     node scripts/check-bidi.mjs
 *
 * Under `direction: rtl` the neutral characters take their direction from
 * whatever runs beside them. A slash, a shekel sign, a colon, a hyphen. So
 * `218 / 340` in a Hebrew line renders as `340 / 218`, and `₪1,200` puts the
 * sign on the wrong end. Both are correct in the source, both are wrong on
 * screen, and neither looks like a bug so much as a typo somebody else made.
 *
 * The fix is always the same and lives in src/components/Ltr.tsx: an isolate
 * with `white-space: nowrap`. `<Money>`, `<Ratio>` and `<Ltr>` apply it.
 *
 * This finds the places that build such a string by hand instead. It is a
 * lint, not a proof: it reads text, it does not render it. It errs toward
 * saying something, because the failure it is looking for is invisible in
 * review and a false positive costs a glance.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
};
walk(src);

/* The helper's own file defines the wrapping, and a route that emits a
   calendar or a CSV is not rendering in a browser at all. */
const exempt = (path) => /components[\\/]Ltr\.tsx$/.test(path)
  || /\.(ics|csv)[\\/]route\.tsx?$/.test(path)
  || /[\\/]route\.ts$/.test(path);

const findings = [];

for (const file of files) {
  if (exempt(file)) continue;
  const where = relative(root, file);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    /* A line that already reaches for the helper is doing the right thing.
       Checked on the line rather than on the file: a screen can hold one
       amount that is wrapped and another that is not, and that is exactly
       how the unwrapped ones survived. */
    const wrapped = /<(Ltr|Money|Ratio)\b/.test(line);
    const code = line.replace(/\/\/.*$/, '');

    /* A comment is prose about the code, not the code. One of them explains
       this very failure and was reported as an instance of it. */
    if (/^\s*(\/\*|\*|\/\/)/.test(line)) return;

    /* A storage key is a slash between two values and never reaches a
       screen. `${clientId}/${uuid}.jpg` is a path, not a ratio, and the
       extension on the end is what says so. */
    if (/\bconst\s+(path|key|name|dir|prefix)\s*=/.test(code)) return;

    /* A shekel sign glued to something that is not already inside a helper. */
    if (/₪/.test(code) && !wrapped
        && !/placeholder|Ph:|aria-label|title=/.test(code)) {
      findings.push({ where, line: i + 1, why: 'a shekel sign built by hand', text: line.trim() });
    }

    /* `{a}/{b}` and `{a} / {b}` in JSX: two interpolations either side of a
       slash. A path or a URL has quotes or a leading slash; a ratio does
       not. */
    if (!wrapped && /\}\s*\/\s*\{/.test(code)
        && !/(href|src|action|url|import|from)\b/.test(code)) {
      findings.push({ where, line: i + 1, why: 'a ratio built by hand', text: line.trim() });
    }

    /* A Hebrew date inside an LTR isolate.
       `15 באוקטובר 2025` is a Hebrew sentence with digits in it, not a neutral
       string. Isolating it lays it out left to right inside a right to left
       paragraph, which puts the day at the far end and makes it read
       `באוקטובר 2025 15`. Six screens shipped that way in one afternoon.
       A formatter using `month: 'long'` or `'short'` on he-IL produces Hebrew;
       one producing `27.08.26` is the opposite case and does need the isolate,
       which is why this looks for the formatter and not for the wrapper. */
    if (/<Ltr>\{[^}]*(?:date|Date)[A-Za-z]*Fmt\.format/.test(code)) {
      findings.push({ where, line: i + 1, why: 'a Hebrew date isolated as ltr', text: line.trim() });
    }

    /* The same thing inside a template literal. */
    if (!wrapped && /\$\{[^}]+\}\s*\/\s*\$\{/.test(code)
        && !/(href|src|action|url|`\/|https?:)/.test(code)) {
      findings.push({ where, line: i + 1, why: 'a ratio in a template literal', text: line.trim() });
    }
  });
}

if (findings.length === 0) {
  console.log(`every amount and ratio is isolated  (${files.length} files read)`);
  process.exit(0);
}

console.log('\nFAIL  a mixed number that will reorder under rtl\n');
console.log('  Wrap it: <Money value={n} />, <Ratio of={a} total={b} />, or <Ltr>…</Ltr>.\n');
for (const f of findings) {
  console.log(`  ${f.where}:${f.line}  ${f.why}`);
  console.log(`      ${f.text.slice(0, 110)}`);
}
process.exit(1);
