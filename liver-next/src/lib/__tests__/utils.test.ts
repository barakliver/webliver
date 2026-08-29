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

/* ── where a mailed link points ──────────────────────────────────────────── */
import { publicEnv, PLATFORM_HOST } from '../env.ts';

test('a mailed link never points at the recipient’s own machine', () => {
  /* The one variable that breaks nothing visible and ruins every invitation.
     A production build carrying a laptop's address mails `localhost:3000` to
     a couple, who get a connection refused and no way to tell why. */
  assert.ok(!/localhost|127\.0\.0\.1/.test(publicEnv.siteUrl), publicEnv.siteUrl);
  assert.ok(publicEnv.siteUrl.startsWith('http'), publicEnv.siteUrl);
});

test('with nothing configured it is the real host', () => {
  assert.equal(PLATFORM_HOST, 'liverproductions.com');
});

/* ── where a sign-in comes back to ───────────────────────────────────────── */

/** The callback route's own rule, stated here so the trap that broke Google
 *  sign-in cannot come back without a test failing. */
function siteOrigin(headers: Record<string, string>, prod: boolean): string {
  const host = (headers['x-forwarded-host'] ?? headers.host ?? '').split(',')[0].trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(host);
  if (host && !(local && prod)) {
    const proto = (headers['x-forwarded-proto'] ?? '').split(',')[0].trim()
      || (local ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return 'https://liverproductions.com';
}

test('behind the proxy it comes back to the site, not to the machine', () => {
  /* What actually arrives on the droplet: Caddy answers liverproductions.com
     over TLS and forwards a plain request to 127.0.0.1:3000. Reading the
     origin off that request is what sent people to their own computer. */
  assert.equal(
    siteOrigin({ host: 'localhost:3000', 'x-forwarded-host': 'liverproductions.com', 'x-forwarded-proto': 'https' }, true),
    'https://liverproductions.com',
  );
});

test('a proxy that forwards nothing still cannot send anybody to localhost', () => {
  assert.equal(siteOrigin({ host: 'localhost:3000' }, true), 'https://liverproductions.com');
  assert.equal(siteOrigin({}, true), 'https://liverproductions.com');
});

test('in development localhost is the right answer and is kept', () => {
  assert.equal(siteOrigin({ host: 'localhost:3000' }, false), 'http://localhost:3000');
});

test('a forwarded host list takes the first, which is the browser’s', () => {
  assert.equal(
    siteOrigin({ 'x-forwarded-host': 'liverproductions.com, internal.lan', 'x-forwarded-proto': 'https, http' }, true),
    'https://liverproductions.com',
  );
});
