/**
 * Every date formatter has to say which zone it means.
 *
 *     node scripts/check-dates.mjs
 *
 * Left unsaid, `Intl` uses the zone of whatever is running, and this product
 * renders each screen twice on two machines that do not share one: a server in
 * UTC and a phone in Israel. The same timestamp came out as 08:37 on the
 * server and 11:37 in the browser, React found the two disagreed and threw the
 * whole page away — which is what the six "blank screens" turned out to be.
 *
 * It is the wrong answer even when nothing crashes. The hour a band arrives is
 * a fact about the venue, not about the reader: a producer opening the run
 * sheet from a hotel abroad needs the time the truck is actually turning up.
 *
 * So the rule is not "remember to pass timeZone", which is a thing to forget on
 * the fourteenth formatter. The rule is that the build refuses one without it.
 *
 * A formatter that genuinely means UTC — a calendar export, a log line — says
 * so with a `zone-ok:` comment naming the reason, on the line above.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');

/** Date and time fields. A `toLocaleString` carrying one of these is
 *  formatting a moment; one carrying none of them is formatting a number, and
 *  a number has no timezone to get wrong. */
const DATE_KEYS = /\b(hour|minute|second|day|month|year|weekday|dateStyle|timeStyle|era|timeZoneName)\s*:/;

/** From an opening parenthesis, the text of the call. Counted rather than
 *  matched: an options object contains braces and a nested call contains
 *  parentheses, and a regex that stops at the first `)` reads half of them. */
function callText(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length && i < openParen + 4000; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(openParen, i + 1);
    }
  }
  return src.slice(openParen, openParen + 4000);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    /* Tests build their own formatters over fixed inputs and assert on what
       comes out; they are not what renders twice on two machines. */
    if (/\.(ts|tsx)$/.test(entry) && !full.includes('__tests__')) files.push(full);
  }
})(SRC);

const problems = [];

/** The same text with every comment blanked out, character for character, so
 *  line numbers and offsets still line up. A prose mention of a formatter in a
 *  doc comment is not a formatter, and this file's own explanation of the rule
 *  was the first thing the rule caught. */
function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const src = withoutComments(raw);
  const lines = raw.split('\n');

  const patterns = [
    { re: /new Intl\.DateTimeFormat\s*\(/g, what: 'Intl.DateTimeFormat', always: true },
    { re: /\.toLocaleDateString\s*\(/g, what: 'toLocaleDateString', always: true },
    { re: /\.toLocaleTimeString\s*\(/g, what: 'toLocaleTimeString', always: true },
    { re: /\.toLocaleString\s*\(/g, what: 'toLocaleString', always: false },
  ];

  for (const { re, what, always } of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const open = src.indexOf('(', m.index + m[0].length - 1);
      const call = callText(src, open);

      /* A number being formatted for display. No moment, no zone. */
      if (!always && !DATE_KEYS.test(call)) continue;
      /* `zoned(...)` from appDates is the helper that adds it, so a call
         wrapped in one has already answered the question. */
      if (/\btimeZone\s*:/.test(call) || /\bzoned\s*\(/.test(call)) continue;

      const line = src.slice(0, m.index).split('\n').length;
      /* The deliberate exception, which has to name itself. */
      const above = (lines[line - 2] ?? '') + (lines[line - 1] ?? '');
      if (/zone-ok:/.test(above)) continue;

      problems.push({
        file: relative(root, file),
        line,
        what,
        text: (lines[line - 1] ?? '').trim().slice(0, 96),
      });
    }
  }
}

if (problems.length === 0) {
  console.log(`\nevery date formatter names its zone  (${files.length} files read)\n`);
  process.exit(0);
}

console.error(`\n${problems.length} formatter${problems.length === 1 ? '' : 's'} without a zone:\n`);
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}  ${p.what}`);
  console.error(`    ${p.text}\n`);
}
console.error('Add `timeZone: EVENT_ZONE` from src/lib/clock.ts. If UTC is genuinely');
console.error('meant — a calendar export, a log — put a `zone-ok: <reason>` comment');
console.error('on the line above and say why.\n');
process.exit(1);
