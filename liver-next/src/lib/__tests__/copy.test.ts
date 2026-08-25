import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two editorial rules, checked rather than remembered.
 *
 * Both are the kind of thing that is obvious in review and invisible once it
 * ships: an em dash reads as ordinary punctuation, and a bare shekel string
 * looks correct in the source and renders with the sign on the wrong side.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(path, out);
    } else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Strip comments, so the rule applies to copy and not to prose about code. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FILES = walk('src');

test('no em dash reaches a person', () => {
  /* An editorial rule from the brand, and one that cannot be enforced by
     taste: an em dash inside Hebrew copy is not visibly wrong, it is just not
     theirs. Fifteen of them were in the app when this was written. */
  const guilty: string[] = [];
  for (const f of FILES) {
    const body = stripComments(readFileSync(f, 'utf8'));
    for (const [i, line] of body.split('\n').entries()) {
      if (line.includes('—')) guilty.push(`${f}:${i + 1}  ${line.trim().slice(0, 70)}`);
    }
  }
  assert.deepEqual(guilty, [], '\n' + guilty.join('\n'));
});

test('money is never rendered as a bare string', () => {
  /* `{ils(x)}` inside JSX puts a shekel sign into a right-to-left paragraph
     with nothing isolating it, and the sign moves to the wrong end of the
     number. <Money> is the same value with the isolate around it. The string
     helper stays exported for titles, CSV cells and email bodies, which are
     the places a bare string is the correct answer. */
  const guilty: string[] = [];
  for (const f of FILES) {
    if (f.endsWith('Ltr.tsx')) continue;
    const body = stripComments(readFileSync(f, 'utf8'));
    for (const [i, line] of body.split('\n').entries()) {
      if (/\{\s*ils\(/.test(line) || /\{[^}]*\?[^}]*\bils\(/.test(line)) {
        guilty.push(`${f}:${i + 1}  ${line.trim().slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(guilty, [], '\n' + guilty.join('\n'));
});

test('the isolate carries both halves of the fix', () => {
  /* An isolate without nowrap still breaks across two lines, and a value that
     breaks strands the currency sign on the line above. Both or neither. */
  const src = readFileSync('src/components/Ltr.tsx', 'utf8');
  assert.match(src, /unicodeBidi:\s*'isolate'/);
  assert.match(src, /whiteSpace:\s*'nowrap'/);
  assert.match(src, /dir="ltr"/);
});
