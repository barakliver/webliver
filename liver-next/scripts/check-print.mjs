#!/usr/bin/env node
/**
 * The printable pages actually reach the paper.
 *
 * Four screens in this product are documents: the run sheet, the suppliers'
 * numbers sheet, the bar calculation and the operating playbook. All four
 * printed a blank page, for the same reason, for as long as they had existed.
 *
 * Each one carried its own copy of
 *
 *     body > *            { display: none !important; }
 *     body > .thing-print { display: block !important; }
 *
 * which is correct only if the document is a direct child of <body>. None of
 * them is: every signed-in screen renders several levels inside the app
 * shell, so the first rule hid the shell and took the document down with it,
 * and the second rule matched nothing at all. Verified in a browser under
 * print emulation before it was changed — the document computed to zero
 * height — and again afterwards.
 *
 * Nothing caught it because a print stylesheet is invisible until somebody is
 * standing at a printer with a folder to fill, which in this product is a
 * producer on the morning of a wedding. That is the worst possible moment to
 * discover it, so this runs with the rest of the checks instead.
 *
 * Two rules:
 *
 *   1. The broken idiom is banned outright.
 *   2. A file that marks something `print-doc` must not also ship its own
 *      `display: none` on an ancestor, which is the same mistake wearing the
 *      new class name.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(p)) out.push(p);
  }
  return out;
};

const files = walk('src');
const problems = [];

/* The rule that broke all four, in the shapes it is likely to be rewritten
   in. Whitespace between the parts is not meaningful, so it is collapsed
   before matching rather than guessed at. */
const BROKEN = /body\s*>\s*\*\s*\{[^}]*display\s*:\s*none/i;

/* Prose about the rule is not the rule. Comments are removed before matching
   rather than excused line by line: the first version of this excused any
   line containing a backtick, which is precisely where these rules live in a
   .tsx file, so it read the real thing as an explanation of itself and passed.
   Caught by putting the bug back and watching nothing happen. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

for (const f of files) {
  if (f.endsWith('check-print.mjs')) continue;

  if (BROKEN.test(stripComments(readFileSync(f, 'utf8')))) {
    problems.push(`${f}\n    hides every child of body, which hides the document too`);
  }
}

/* Every document must be marked, and the shared rules must exist to mark it
   against. A rename in globals.css that missed the pages would otherwise pass
   silently and print blank again. */
const css = readFileSync('src/app/globals.css', 'utf8');
if (!/\.print-doc\s*,\s*\.print-doc\s*\*/.test(css)) {
  problems.push('src/app/globals.css\n    the .print-doc rules are gone, so nothing is visible when printing');
}

const marked = files.filter((f) => f.endsWith('.tsx') && /className="[^"]*\bprint-doc\b/.test(readFileSync(f, 'utf8')));

if (problems.length) {
  console.error('\nprint would come out blank:\n');
  for (const p of problems) console.error('  ' + p);
  console.error('');
  process.exit(1);
}

console.log(`\nevery printable page can reach paper  (${marked.length} documents, ${files.length} files read)\n`);
