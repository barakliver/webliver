import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientConfirmEmail, clientConfirmSubject } from '../notify/templates.ts';

/**
 * The one letter that leaves the business.
 *
 * Every other template here goes to the office and is Hebrew for good. This
 * one lands in the inbox of somebody who has just met the brand through a form
 * they filled in, and it was Hebrew whatever language they filled it in — laid
 * out right to left, signed off in a script they cannot read, as the first
 * thing the business ever said to them.
 *
 * Checked on the rendered letter rather than on a copy table, because the two
 * things that were wrong were not words: the direction on the wrapper and the
 * subject line, neither of which any copy file would have caught.
 */

test('an English enquirer gets an English letter, laid out left to right', () => {
  const html = clientConfirmEmail('Dana', undefined, 'en');
  assert.match(html, /dir="ltr"/);
  assert.match(html, /Thank you Dana/);
  assert.doesNotMatch(html, /[֐-׿]/, 'no Hebrew reached an English reader');
  assert.equal(clientConfirmSubject('en'), 'We have your enquiry');
});

test('and a Hebrew one gets the letter it always got', () => {
  const html = clientConfirmEmail('דנה', undefined, 'he');
  assert.match(html, /dir="rtl"/);
  assert.match(html, /תודה דנה/);
  assert.match(clientConfirmSubject('he'), /[֐-׿]/);
});

test('no language named is the language the business speaks', () => {
  /* The default matters: this is called from one place today, and the next
     caller that forgets the argument must not silently send English to an
     Israeli couple. */
  assert.match(clientConfirmEmail('דנה'), /dir="rtl"/);
});

test('a tenant’s letter still signs with the tenant, in either language', () => {
  const brand = { name: 'Studio North', tagline: 'events by the sea' };
  for (const locale of ['he', 'en'] as const) {
    const html = clientConfirmEmail('Dana', brand, locale);
    assert.match(html, /Studio North/);
    assert.doesNotMatch(html, new RegExp(String.raw`>\s*Liver`), 'the platform did not sign a tenant’s letter');
  }
});
