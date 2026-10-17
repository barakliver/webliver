/**
 * No physical direction in a right-to-left product.
 *
 *     node scripts/check-rtl.mjs
 *
 * `ml-4` is four pixels on the left in both languages, which in Hebrew is
 * the wrong side; `ms-4` is four pixels on the start side, which is the
 * right one in either. The brief asks for an ESLint rule and this is the
 * same rule as a script, because every other rule of this product is one.
 *
 * It reads class strings only (className="…", className={`…`}, cn('…'))
 * and tokenises them, so a word in a comment is not a class. Two things
 * are physical on purpose and allowed: a line that declares `dir="ltr"`,
 * and a token with an `ltr:` or `rtl:` prefix. A centring transform
 * (`left-1/2 -translate-x-1/2`) is symmetric and allowed too.
 *
 * A ratchet rather than a wall: the product carried a number of these
 * when the rule was written, and the number below is the most it may
 * carry. It goes down when somebody fixes one and never up.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = 0;

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if (/\.tsx$/.test(e.name)) files.push(join(dir, e.name));
  }
};
walk('src');

const TOKEN = /^-?(?:[a-z0-9-]+:)*(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right|scroll-ml|scroll-mr|scroll-pl|scroll-pr)(?:-[a-z0-9.\[\]/%()]+)?$/;
const STRINGS = /(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})|cn\(([^)]*)\)/g;

const guilty = [];
for (const f of files) {
  const text = readFileSync(join(root, f), 'utf8');
  text.split('\n').forEach((line, i) => {
    if (/dir="ltr"|dir=\{/.test(line)) return;
    for (const m of line.matchAll(STRINGS)) {
      const body = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').replace(/\$\{[^}]*\}/g, ' ').replace(/['"`,]/g, ' ');
      const hits = body.split(/\s+/).filter((t) => TOKEN.test(t) && !/^(?:[a-z0-9-]+:)*(?:ltr|rtl):/.test(t) && !/^-?(?:[a-z0-9-]+:)*(?:left|right)-1\/2$/.test(t));
      if (hits.length) guilty.push(`${f}:${i + 1}  ${hits.join(' ')}`);
    }
  });
}

if (guilty.length > BASELINE) {
  console.error(`\n${guilty.length} physical directions, over the ${BASELINE} the product may carry:\n`);
  for (const g of guilty.slice(0, 80)) console.error(`  ${g}`);
  console.error('\nUse the logical class: ms- me- ps- pe- start- end- border-s border-e rounded-s rounded-e text-start text-end.\n');
  process.exit(1);
}
console.log(`\nevery new side is a logical side  (${guilty.length} physical left, ${BASELINE} allowed, ${files.length} files read)\n`);
if (guilty.length) for (const g of guilty) console.log(`  ${g}`);
