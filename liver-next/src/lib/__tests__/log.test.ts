import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correlationId, logFailure, logWarning } from '../log.ts';

/**
 * The rule that matters here is not the shape of the line, it is what cannot
 * get into it. A log carrying a couple's name and venue is a second copy of
 * the database kept somewhere nobody guards, so the test that earns its place
 * is the one that hands the logger an object holding a whole event and checks
 * that none of it comes out.
 */

/** Runs something with console.error captured, and returns what was written. */
function captured(run: () => void): string[] {
  const lines: string[] = [];
  const real = { error: console.error, warn: console.warn };
  console.error = (l: string) => { lines.push(String(l)); };
  console.warn = (l: string) => { lines.push(String(l)); };
  try { run(); } finally { console.error = real.error; console.warn = real.warn; }
  return lines;
}

test('a failure is one line of JSON with the standing keys', () => {
  const [line] = captured(() => logFailure('auth', 'code exchange failed', { at: '/login', role: 'anon' }));
  const o = JSON.parse(line);
  assert.equal(o.level, 'error');
  assert.equal(o.tag, 'auth');
  assert.equal(o.message, 'code exchange failed');
  assert.equal(o.at, '/login');
  assert.equal(o.role, 'anon');
  assert.equal(typeof o.release, 'string');
  assert.equal(typeof o.ref, 'string');
  /* The route and the clock are different keys. They were the same one, and
     the route won: every line carried a path where its timestamp should be. */
  assert.match(o.time, /^\d{4}-\d{2}-\d{2}T/);
});

test('the reference it returns is the one it wrote', () => {
  let ref = '';
  const [line] = captured(() => { ref = logFailure('lead', 'insert refused'); });
  assert.equal(JSON.parse(line).ref, ref);
  assert.ok(ref.length > 0);
});

test('a caller may supply the reference, so a screen and a log agree', () => {
  const [line] = captured(() => logFailure('site', 'render failed', { ref: 'ABCD2345' }));
  assert.equal(JSON.parse(line).ref, 'ABCD2345');
});

test('an event cannot smuggle itself into a log line', () => {
  /* The way this goes wrong is never a decision to log a guest list. It is
     passing the row that happens to contain one. */
  const event = {
    at: '/app/clients',
    doing: 'convert-lead',
    couple: { name: 'נועה ואיתי', phone: '050-0000000' },
    guests: ['שירה', 'אורי'],
    venue: 'אחוזת הדקלים',
    notes: 'הכלה ביקשה לא להזמין את הדוד',
  };
  const [line] = captured(() => logFailure('lead', 'convert failed', event as never));
  const o = JSON.parse(line);

  assert.equal(o.at, '/app/clients');
  assert.equal(o.doing, 'convert-lead');
  for (const key of ['couple', 'guests', 'venue', 'notes']) {
    assert.equal(key in o, false, `${key} reached the log`);
  }
  assert.equal(line.includes('נועה'), false);
  assert.equal(line.includes('אחוזת'), false);
  assert.equal(line.includes('050-'), false);
});

test('a reference survives being read aloud', () => {
  /* Somebody reads this over the phone from a screen. No lowercase, and none
     of the four characters that get heard as each other. */
  for (let i = 0; i < 200; i++) {
    const id = correlationId();
    assert.equal(id.length, 8);
    assert.match(id, /^[A-Z0-9]{8}$/);
    assert.equal(/[OI1L0]/.test(id), false, `ambiguous character in ${id}`);
  }
});

test('two references in a row are not the same one', () => {
  const seen = new Set(Array.from({ length: 500 }, () => correlationId()));
  assert.ok(seen.size > 495, `only ${seen.size} distinct out of 500`);
});

test('a warning is a warning and carries no reference it was not given', () => {
  const [line] = captured(() => logWarning('mail', 'no provider configured', { at: '/api/cron' }));
  const o = JSON.parse(line);
  assert.equal(o.level, 'warn');
  assert.equal('ref' in o, false);
});
