import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyWrite, whyNotSaved, worthRetrying } from '../writeFailure.ts';

/**
 * The whole value of this file is in the mapping being right, and a mapping
 * is the one thing you cannot check by looking at a screen: every branch
 * produces a plausible Hebrew sentence whether or not it is the correct one.
 */

test('a duplicate is a duplicate, and trying again will not help', () => {
  assert.equal(classifyWrite({ code: '23505', message: 'duplicate key value' }), 'duplicate');
  assert.equal(worthRetrying({ code: '23505' }), false);
  /* The sentence must not say "try again": it is the one case where the
     advice produces the same failure, three times, before anybody thinks to
     look for the row that is already there. */
  assert.ok(!whyNotSaved({ code: '23505' }).includes('לנסות שוב'));
});

test('a value the table refuses is a field to fix, not a retry', () => {
  for (const code of ['23514', '23502', '22P02', '22001']) {
    assert.equal(classifyWrite({ code }), 'refused', code);
  }
  assert.equal(worthRetrying({ code: '23514' }), false);
});

test('a row that went away says so, because it usually went away in another tab', () => {
  assert.equal(classifyWrite({ code: '23503' }), 'missing');
  assert.equal(classifyWrite({ code: 'PGRST116' }), 'missing');
  assert.ok(whyNotSaved({ code: '23503' }).includes('לרענן'));
});

test('a request that never landed has no code at all', () => {
  /* undici throws this, and the Supabase client passes it through untouched.
     Branching on the message is wrong everywhere else and is the only thing
     available here. */
  assert.equal(classifyWrite({ message: 'fetch failed' }), 'offline');
  assert.equal(classifyWrite({ message: 'The operation was aborted' }), 'offline');
  assert.equal(classifyWrite({ code: '08006', message: 'connection failure' }), 'offline');
  assert.equal(worthRetrying({ message: 'fetch failed' }), true);
});

test('a message that mentions a network but carries a real code is not offline', () => {
  /* The message is English prose that changes between releases. A code wins
     over it every time, or a constraint whose name happens to contain the
     word would be read as a dropped connection. */
  assert.equal(classifyWrite({ code: '23505', message: 'network_id already exists' }), 'duplicate');
});

test('anything else is the one case where try again is honest', () => {
  assert.equal(classifyWrite({ code: 'XX000', message: 'internal error' }), 'unknown');
  assert.equal(classifyWrite(null), 'unknown');
  assert.equal(classifyWrite(undefined), 'unknown');
  assert.ok(whyNotSaved({ code: 'XX000' }).includes('לנסות שוב'));
  assert.equal(worthRetrying({ code: 'XX000' }), true);
});

test('both languages answer every situation', () => {
  const codes = ['23505', '23514', '23503', '08006', 'XX000'];
  for (const code of codes) {
    for (const l of ['he', 'en'] as const) {
      const said = whyNotSaved({ code }, l);
      assert.ok(said.length > 10, `${code} ${l}`);
    }
  }
  /* And they are not the same string, which is how a missing translation
     looks when nobody checks. */
  assert.notEqual(whyNotSaved({ code: '23505' }, 'he'), whyNotSaved({ code: '23505' }, 'en'));
});

test('permission is deliberately not answered here', () => {
  /* 42501 falls through to unknown on purpose. lib/rls.ts asks the database
     the four questions the policy asks and answers far better than a code
     table can; collecting a generic sentence here would be the quieter and
     worse answer. */
  assert.equal(classifyWrite({ code: '42501', message: 'permission denied' }), 'unknown');
});
