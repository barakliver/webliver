import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The shape of the move to beforeidoevent.com, held as a test.
 *
 * `scripts/caddy-rebrand.py` writes the Caddy half of it, and a Caddy file is
 * the kind of thing that is wrong silently: it loads, it serves, and what it
 * serves is not what was meant. The two sentences this protects are the ones
 * REBRAND.md puts first - the lead webhooks and the calendar feeds must keep
 * answering on the old name rather than redirect, because the people who
 * pasted those addresses cannot be reached to paste new ones.
 *
 * Skipped where there is no python3, which is only a machine that cannot run
 * the script either.
 */
const here = dirname(fileURLToPath(import.meta.url));
const PY = join(here, '../../../../scripts/caddy-rebrand.py');
const have = spawnSync('python3', ['--version']).status === 0;
const opts = { skip: !have && 'python3 is not installed' };

const render = (phase: 1 | 2, il = ''): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rebrand-'));
  const out = join(dir, 'liver-rebrand.caddy');
  execFileSync('python3', [PY, 'render', out, '3000', '--phase', String(phase), ...(il ? ['--il', il] : [])]);
  return readFileSync(out, 'utf8');
};

test('phase one adds the new names and claims none of the old ones', opts, () => {
  const c = render(1);
  assert.match(c, /^beforeidoevent\.com, www\.beforeidoevent\.com \{/m);
  assert.match(c, /^app\.beforeidoevent\.com \{/m);
  assert.doesNotMatch(c, /liverproductions\.com/, 'two blocks claiming one address is a config Caddy refuses');
  assert.doesNotMatch(c, /co\.il/);
});

test('the old name keeps answering webhooks and calendar feeds for real', opts, () => {
  const c = render(2);
  for (const host of ['liverproductions.com, www.liverproductions.com', 'app.liverproductions.com']) {
    const at = c.indexOf(`\n${host} {`);
    assert.ok(at >= 0, host);
    const block = c.slice(at, c.indexOf('\n}\n', at));
    assert.match(block, /@alive path \/api\/\* \/feed\/\*/, `${host} must keep /api and /feed`);
    assert.match(block, /handle @alive \{[\s\S]*reverse_proxy 127\.0\.0\.1:3000/, `${host} must proxy them`);
    assert.match(block, /redir https:\/\/(app\.)?beforeidoevent\.com\{uri\} permanent/, `${host} redirects the rest`);
  }
});

test('the app host redirects to the app host and the old site to the site', opts, () => {
  const c = render(2);
  assert.match(c, /app\.liverproductions\.com \{[\s\S]*?redir https:\/\/app\.beforeidoevent\.com\{uri\} permanent/);
  assert.match(c, /^liverproductions\.com, www\.liverproductions\.com \{[\s\S]*?redir https:\/\/beforeidoevent\.com\{uri\} permanent/m);
});

test('the Israeli names redirect only when they are asked for', opts, () => {
  assert.doesNotMatch(render(2), /co\.il/);
  const c = render(2, 'beforeidoevent.co.il,beforeidoevents.co.il');
  assert.match(c, /beforeidoevent\.co\.il, www\.beforeidoevent\.co\.il, beforeidoevents\.co\.il, www\.beforeidoevents\.co\.il \{\n\tredir https:\/\/beforeidoevent\.com\{uri\} permanent/);
});

test('the game is never touched', opts, () => {
  /* beforeido.co.il is a different registrable domain on its own host. The
     business links to it; nothing here may claim it. */
  assert.doesNotMatch(render(2, 'beforeidoevent.co.il'), /beforeido\.co\.il/);
});

test('adopt takes over the old blocks, adds the import once, and is idempotent', opts, () => {
  const dir = mkdtempSync(join(tmpdir(), 'rebrand-'));
  const file = join(dir, 'Caddyfile');
  writeFileSync(file, [
    '{\n\temail me@example.com\n}',
    '# >>> liver-next managed',
    'liverproductions.com, www.liverproductions.com {\n\treverse_proxy 127.0.0.1:3000\n}',
    '# <<< liver-next managed',
    'app.liverproductions.com {\n\treverse_proxy 127.0.0.1:3000\n}',
    'other.example.com {\n\treverse_proxy 127.0.0.1:9999\n}',
    '',
  ].join('\n'));
  const inc = '/etc/caddy/liver-rebrand.caddy';
  execFileSync('python3', [PY, 'adopt', file, inc]);
  const once = readFileSync(file, 'utf8');
  assert.doesNotMatch(once, /^liverproductions\.com/m, 'the managed block is gone');
  assert.doesNotMatch(once, /^app\.liverproductions\.com/m, 'the hand-written block is commented out');
  assert.match(once, /^other\.example\.com \{/m, 'somebody else\'s site is left alone');
  assert.equal(once.split(`import ${inc}`).length - 1, 1);
  execFileSync('python3', [PY, 'adopt', file, inc]);
  assert.equal(readFileSync(file, 'utf8'), once, 'a second run changes nothing');
});
