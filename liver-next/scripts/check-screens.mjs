/**
 * Every screen in the workspace can be reported from.
 *
 *     node scripts/check-screens.mjs
 *
 * The report button was built into the one header component every screen uses,
 * and that was described — by me, in a commit message — as reaching every
 * screen from one place. It did not. The component accepted the button and
 * seven of nineteen screens passed one, so the twelve most likely to be worth
 * reporting from, the event file among them, had no way to say so. Nobody
 * would ever have found that by looking: the header looks complete either way.
 *
 * A claim about coverage that is not checked is a claim that drifts back. So
 * the rule is here rather than in a memory: a PageHead without a report button
 * fails the build, and adding a screen means answering the question.
 *
 * The parsing has one wrinkle worth naming, because the first attempt at this
 * got it wrong and reported a false miss. A JSX element does not end at the
 * first `>` — `sub={openGaps > 0 ? …}` has one inside an expression — so the
 * scan tracks brace depth and only treats a bracket at depth zero as the end
 * of the tag.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS = join(root, 'src', 'app', 'app');

/** The text of one JSX opening tag, from `<` to the `/>` or `>` that closes
 *  it, ignoring anything inside a braced expression. */
function tagAt(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0 && ch === '/' && src[i + 1] === '>') return src.slice(start, i + 2);
    else if (depth === 0 && ch === '>') return src.slice(start, i + 1);
  }
  return src.slice(start);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (entry.endsWith('.tsx')) files.push(full);
  }
})(SCREENS);

const missing = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const re = /<PageHead\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tag = tagAt(src, m.index);
    if (/\breport=/.test(tag)) continue;
    missing.push({
      file: relative(root, file),
      line: src.slice(0, m.index).split('\n').length,
      title: /title=\{([^}]{0,48})/.exec(tag)?.[1]?.trim() ?? '',
    });
  }
}

const seen = files.length;
if (missing.length === 0) {
  console.log(`\nevery screen can be reported from  (${seen} files read)\n`);
  process.exit(0);
}

console.error(`\n${missing.length} screen${missing.length === 1 ? '' : 's'} with no way to report a problem:\n`);
for (const p of missing) {
  console.error(`  ${p.file}:${p.line}${p.title ? `  ${p.title}` : ''}`);
}
console.error('\nPass report={<IssueReporter userId={account.id} context={…} />} to');
console.error('PageHead. On a screen a couple can also see, pass copy={ticketFor(locale)}');
console.error('so the form is in the language the rest of the page is in.\n');
process.exit(1);
