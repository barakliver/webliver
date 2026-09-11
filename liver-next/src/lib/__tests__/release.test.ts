import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentState, redact, servesLive, shortSha } from '../release.ts';

const LOG_OK = [
  '2026-09-11T09:02:11Z  release c72be07aa (c72be07) is not live yet',
  '2026-09-11T09:02:12Z  backing up to /var/lib/liver-agent/backups/before-x.sql.gz',
  '2026-09-11T09:02:40Z  backup ok (3.1M)',
  '2026-09-11T09:02:41Z  levelling the schema',
  '2026-09-11T09:02:49Z  schema levelled',
  '2026-09-11T09:02:49Z  deploying c72be07aa (attempt 1 of 2)',
  '2026-09-11T09:07:03Z  deployed and every screen draws something',
].join('\n');

const LOG_BACK = [
  '2026-09-11T08:41:00Z  deploying 426f79cbb (attempt 2 of 2)',
  '2026-09-11T08:46:30Z  FAIL  the release is up and the check found screens that do not draw.',
  '2026-09-11T08:46:30Z  putting 5bc5e49aa back',
  '2026-09-11T08:51:10Z  rolled back to 5bc5e49aa, which is serving now',
  '2026-09-11T08:51:10Z  giving up on 426f79cbb after 2 attempts. It will not be tried again.',
].join('\n');

test('a clean release reads as ok, with the commits and the time', () => {
  const s = parseAgentState({ deployed: 'c72be07aa\n', previous: '5bc5e49aa', log: LOG_OK }, 'c72be07');
  assert.equal(s.found, true);
  assert.equal(s.result, 'ok');
  assert.equal(s.live, 'c72be07aa');
  assert.equal(s.previous, '5bc5e49aa');
  assert.equal(s.gaveUp, null);
  assert.equal(s.at, '2026-09-11T09:07:03Z');
  assert.equal(servesLive(s), true);
});

test('a rollback with a gave-up file reads as rolled back, and names the tag', () => {
  const s = parseAgentState(
    { deployed: '5bc5e49aa', gaveUp: '426f79cbb', tried: '426f79cbb 2', log: LOG_BACK },
    '5bc5e49',
  );
  assert.equal(s.result, 'rolled-back');
  assert.equal(s.gaveUp, '426f79cbb');
  assert.deepEqual(s.tried, { tag: '426f79cbb', n: 2 });
  assert.equal(servesLive(s), true);
});

test('a build that died reads as build-failed, with the old commit still live', () => {
  const s = parseAgentState({
    deployed: '6b043900c0', tried: 'c2477444f9 1',
    log: [
      '2026-09-11T10:52:15Z  deploying c2477444f9 (attempt 1 of 2)',
      'Killed',
      '2026-09-11T11:03:07Z  FAIL  the build did not finish, so nothing was swapped in.',
      '2026-09-11T11:03:07Z        The site is still serving 6b043900c0, untouched.',
    ].join('\n'),
  }, '6b04390');
  assert.equal(s.result, 'build-failed');
  assert.equal(servesLive(s), true);
});

test('a process on a different commit than the agent recorded is noticed', () => {
  const s = parseAgentState({ deployed: 'c72be07aa', log: LOG_OK }, '5bc5e49');
  assert.equal(servesLive(s), false);
});

test('no state directory is not an error, and development is not a mismatch', () => {
  const s = parseAgentState(null, 'dev');
  assert.equal(s.found, false);
  assert.equal(s.result, 'unknown');
  assert.equal(servesLive(s), null);
});

test('only the tail of the log is kept', () => {
  const log = Array.from({ length: 40 }, (_, i) => `2026-09-11T00:00:${String(i).padStart(2, '0')}Z  line ${i}`).join('\n');
  const s = parseAgentState({ log }, 'dev', 5);
  assert.equal(s.lines.length, 5);
  assert.match(s.lines[4], /line 39/);
});

test('a connection string in the log never reaches the screen', () => {
  const s = parseAgentState({ log: 'psql: could not connect to postgresql://u:p@db.example:5432/x' }, 'dev');
  assert.equal(s.lines[0], 'psql: could not connect to [connection string]');
  assert.equal(redact('Authorization: Bearer abc.def'), 'Authorization: Bearer [hidden]');
  assert.equal(redact('RESEND_API_KEY=re_123'), 'RESEND_API_KEY=[hidden]');
  assert.equal(redact('a key moment ahead'), 'a key moment ahead');
});

test('seven characters, and nothing from nothing', () => {
  assert.equal(shortSha('c72be07aa1234'), 'c72be07');
  assert.equal(shortSha(null), '');
});
