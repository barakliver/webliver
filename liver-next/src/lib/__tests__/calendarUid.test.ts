import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The calendar namespace is frozen, and this is the only thing holding it.
 *
 * A UID is how every calendar in the world decides whether an event it is
 * handed is one it already holds. Four feeds in this product mint them — the
 * producer's own calendar, a single event's file, the couple's date and the
 * crew feed — and all four are *subscribed* to rather than downloaded, so
 * Google and Apple re-read them forever.
 *
 * Changing the string after the `@` therefore renames nothing. It tells every
 * subscriber that every event they hold has been withdrawn and a different
 * event has appeared instead. The old ones do not leave, because a feed
 * cannot delete what it has stopped mentioning — so a couple who subscribed
 * in March would have two of their own wedding at the same hour, and a crew
 * member two of every shift this season, and nobody could fix it from inside
 * the product.
 *
 * The rename to `beforeidoevent.com` is exactly the day somebody reaches for
 * `PLATFORM_HOST` here, because for a year the two were the same constant and
 * it read like a tidy-up. This test is the sentence that stops them.
 */

const root = new URL('../../', import.meta.url).pathname;

function icsRoutes(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { icsRoutes(full, found); continue; }
    if (entry !== 'route.ts') continue;
    const text = readFileSync(full, 'utf8');
    if (text.includes('uid:') || text.includes('const uid')) found.push(full);
  }
  return found;
}

test('every calendar feed mints its UIDs in the frozen namespace', () => {
  const routes = icsRoutes(join(root, 'app'));

  /* Four of them. If this number moves, a fifth feed was added and it has to
     make the same promise as the other four. */
  assert.equal(routes.length, 4, `expected four UID-minting feeds, found ${routes.length}`);

  for (const file of routes) {
    const text = readFileSync(file, 'utf8');
    assert.ok(
      text.includes('UID_HOST'),
      `${file} mints UIDs without UID_HOST`,
    );
    assert.ok(
      !text.includes('PLATFORM_HOST'),
      `${file} builds a UID out of PLATFORM_HOST, which moves when the business is renamed`,
    );
  }
});

test('the namespace is a literal and not something an environment can set', () => {
  const env = readFileSync(join(root, 'lib', 'env.ts'), 'utf8');

  assert.match(env, /export const UID_HOST = 'liverproductions\.com';/);

  /* The address may be configured; the identity may not. A variable is a
     thing somebody can set, and the one guarantee this needs is that nobody
     can. */
  const line = env.split('\n').find((l) => l.includes('export const UID_HOST')) ?? '';
  assert.ok(!line.includes('process.env'), 'UID_HOST must not be read from the environment');
  assert.ok(!line.includes('optional('), 'UID_HOST must not be read from the environment');
});
