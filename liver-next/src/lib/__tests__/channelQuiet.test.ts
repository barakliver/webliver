import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quietDays, QUIET_AFTER_DAYS } from '../../content/channels.ts';

/**
 * The one failure in this product that looks exactly like good news.
 *
 * A lead channel that has stopped delivering is indistinguishable from a week
 * in which nobody enquired, and the money spent on the ads is spent either
 * way. The rename to beforeidoevent.com is the day this matters most: every
 * channel address was pasted by hand into Meta or Google and is the only
 * string in this product that lives outside it, and those are POSTs from
 * delivery infrastructure that is not obliged to follow a redirect.
 */

const DAY = 86_400_000;
const NOW = new Date('2026-10-01T09:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

test('a channel that was delivering and went quiet says how long it has been', () => {
  assert.equal(quietDays({ enabled: true, last_lead_at: ago(30) }, NOW), 30);
  assert.equal(quietDays({ enabled: true, last_lead_at: ago(QUIET_AFTER_DAYS) }, NOW), QUIET_AFTER_DAYS);
});

test('an ordinary quiet fortnight is not a fault', () => {
  /* Most quiet weeks are quiet weeks. A warning that fires on every one of
     them is a warning nobody reads by March. */
  assert.equal(quietDays({ enabled: true, last_lead_at: ago(QUIET_AFTER_DAYS - 1) }, NOW), null);
  assert.equal(quietDays({ enabled: true, last_lead_at: ago(0) }, NOW), null);
});

test('a channel that never delivered is a beginning, not a fault', () => {
  /* The row already says "nothing yet" in its own words. Saying it twice,
     once in red, turns somebody halfway through wiring up a channel into
     somebody who thinks they broke it. */
  assert.equal(quietDays({ enabled: true, last_lead_at: null }, NOW), null);
});

test('a channel somebody switched off is silent on purpose', () => {
  assert.equal(quietDays({ enabled: false, last_lead_at: ago(90) }, NOW), null);
});

test('a date the database could not have written is not a warning', () => {
  /* Never a thrown error on a screen somebody opens every morning. */
  assert.equal(quietDays({ enabled: true, last_lead_at: 'not a date' }, NOW), null);
  /* And a clock that disagrees with the server does not invent a warning. */
  assert.equal(quietDays({ enabled: true, last_lead_at: ago(-5) }, NOW), null);
});
