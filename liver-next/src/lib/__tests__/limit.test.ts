import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkLimit, resetLimits, visitorKeyFrom } from '../ai/budget.ts';

/**
 * The ceiling that stands between an anonymous loop in a browser console and
 * this business's API bill — and, since the lanes were split, the wall that
 * stops the producer's own convenience from spending the sales channel's
 * budget.
 */

beforeEach(() => resetLimits());

test('a single caller is cut off at its own ceiling, not the day\'s', () => {
  for (let i = 0; i < 15; i += 1) {
    assert.equal(checkLimit('1.2.3.4').ok, true, `message ${i + 1} should have been allowed`);
  }
  const verdict = checkLimit('1.2.3.4');
  assert.equal(verdict.ok, false);
  if (!verdict.ok) {
    assert.equal(verdict.reason, 'visitor');
    assert.ok(verdict.retryInSec > 0, 'and it says when to come back');
  }
});

test('one caller hitting the wall does not stop the next', () => {
  for (let i = 0; i < 16; i += 1) checkLimit('1.2.3.4');
  assert.equal(checkLimit('5.6.7.8').ok, true);
});

test('a producer working all morning cannot starve the public site', () => {
  /* The bug this test exists for: one shared daily budget meant a producer
     drafting supplier emails exhausted the ceiling, and the couple who then
     arrived on the website was told the assistant was busy. */
  for (let i = 0; i < 600; i += 1) {
    checkLimit(`account:producer-${i % 10}`, 'producer');
  }
  const producer = checkLimit('account:producer-x', 'producer');
  assert.equal(producer.ok, false, 'the producer lane is spent');
  if (!producer.ok) assert.equal(producer.reason, 'day');

  const visitor = checkLimit('9.9.9.9', 'public');
  assert.equal(visitor.ok, true, 'and the visitor is still answered');
});

test('and the public lane cannot starve the producer either', () => {
  for (let i = 0; i < 400; i += 1) checkLimit(`visitor-${i}`, 'public');
  assert.equal(checkLimit('another-visitor', 'public').ok, false);
  assert.equal(checkLimit('account:someone', 'producer').ok, true);
});

test('a producer gets more headroom than a stranger', () => {
  for (let i = 0; i < 16; i += 1) checkLimit('same', 'public');
  assert.equal(checkLimit('same', 'public').ok, false);
  /* The same key in the other lane is a different bucket, which is also what
     keeps a producer browsing their own public site from paying twice. */
  assert.equal(checkLimit('same', 'producer').ok, true);
});

test('who is asking, behind a proxy', () => {
  const forwarded = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });
  assert.equal(visitorKeyFrom(forwarded), '203.0.113.9', 'the first hop is the client');
  assert.equal(visitorKeyFrom(new Headers({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
  assert.equal(visitorKeyFrom(new Headers()), 'unknown', 'and an unknown caller still gets a bucket');
});
