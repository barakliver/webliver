import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cn, FONT_SIZES } from '../utils.ts';

/**
 * cn() has to know this design system's own type scale.
 *
 * tailwind-merge groups `text-*` by what it recognises. A scale name it has
 * never heard of is treated as a colour, so `cn('text-metric', 'text-ink')`
 * returns `text-ink` and the font-size is deleted between the source and the
 * DOM. No warning, no wrong size, just a number that renders at the inherited
 * one and a screen that carries the palette without carrying the design.
 */

test('a size and a colour survive together', () => {
  assert.equal(cn('text-metric', 'text-ink'), 'text-metric text-ink');
  assert.equal(cn('text-metric-sm', 'text-accent-bright'), 'text-metric-sm text-accent-bright');
  assert.equal(cn('text-display', 'text-ink'), 'text-display text-ink');
  assert.equal(cn('text-title', 'text-ink-soft'), 'text-title text-ink-soft');
});

test('two sizes still collapse, and so do two colours', () => {
  assert.equal(cn('text-metric', 'text-metric-sm'), 'text-metric-sm');
  assert.equal(cn('text-ink', 'text-accent'), 'text-accent');
  assert.equal(cn('p-2', 'p-4'), 'p-4');
});

/* The list in utils.ts is written out rather than imported, so that the
   config does not end up in the browser bundle. This is what keeps the two
   from drifting: adding a size to the config and not to the list would put
   the deletion bug straight back, silently, for that one size. */
test('the list matches the sizes the config actually defines', () => {
  const config = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8');
  const block = config.slice(config.indexOf('fontSize: {'));
  const defined = [...block.slice(0, block.indexOf('boxShadow')).matchAll(/^\s{8}'?([a-z0-9-]+)'?:\s*\[/gm)]
    .map((m) => m[1]);

  assert.ok(defined.length > 0, 'could not read fontSize keys out of tailwind.config.ts');
  assert.deepEqual(
    [...defined].sort(), [...FONT_SIZES].sort(),
    'FONT_SIZES in src/lib/utils.ts must list every custom fontSize in tailwind.config.ts, '
    + 'or cn() will silently drop the ones it does not know',
  );
});
