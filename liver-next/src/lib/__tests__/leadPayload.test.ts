import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLead, parseLooseDate, parseLooseCount, slugSource } from '../leadPayload.ts';

test('a Meta lead ad arrives whole', () => {
  /* Meta writes every answer as {name, values: [...]}. When that was not
     recognised as a name/value pair it was walked into instead, and its own
     `name` key landed under one of the aliases for the person's name: every
     lead came in called "full_name", with no phone and no email, and nothing
     looked broken. */
  const meta = {
    entry: [{ changes: [{ value: {
      leadgen_id: '1234567890',
      form_id: '999',
      field_data: [
        { name: 'full_name', values: ['נועה כהן'] },
        { name: 'phone_number', values: ['+972 50-123-4567'] },
        { name: 'email', values: ['NOA@Example.COM'] },
        { name: 'תאריך האירוע', values: ['14/08/2027'] },
        { name: 'כמות אורחים', values: ['כ-350'] },
      ],
    } }] }],
  };
  const lead = readLead(meta, 'instagram');
  assert.equal(lead.full_name, 'נועה כהן');
  assert.equal(lead.phone, '+972 50-123-4567');
  assert.equal(lead.email, 'noa@example.com');
  assert.equal(lead.event_date, '2027-08-14');
  assert.equal(lead.guest_count, 350);
  assert.equal(lead.external_id, 'instagram:1234567890');
  assert.equal(lead.source, 'instagram');
});

test("Google's lead form, which sends columns rather than fields", () => {
  const google = {
    lead_id: 'GA-77',
    google_key: 'secret',
    user_column_data: [
      { column_id: 'FULL_NAME', string_value: 'Avi Levi' },
      { column_id: 'PHONE_NUMBER', string_value: '052-999-1111' },
      { column_id: 'EMAIL', string_value: 'avi@corp.co.il' },
      { column_id: 'COMMENTS', string_value: 'כנס חברה ל-200 איש' },
    ],
  };
  const lead = readLead(google, 'google-ads');
  assert.equal(lead.full_name, 'Avi Levi');
  assert.equal(lead.phone, '052-999-1111');
  assert.equal(lead.kind, 'corporate');
  /* Namespaced with the same slug the row is stored under, so the id and the
     source read as one thing rather than two spellings of it. */
  assert.equal(lead.external_id, 'google_ads:GA-77');
});

test('a first and last name become a name', () => {
  const lead = readLead(
    { firstName: 'Dana', lastName: 'Bar', Phone: '0501112222', 'Event Date': '2027-03-05' },
    'zapier'
  );
  assert.equal(lead.full_name, 'Dana Bar');
  assert.equal(lead.event_date, '2027-03-05');
  assert.equal(lead.external_id, null);
});

test('a date in whatever order it was written, or none', () => {
  assert.equal(parseLooseDate('25/12/2027'), '2027-12-25');
  /* Ambiguity resolves the Israeli way, day first, except where the first
     number cannot be a day, which settles it without guessing. */
  assert.equal(parseLooseDate('12/25/2027'), '2027-12-25');
  assert.equal(parseLooseDate('05.06.27'), '2027-06-05');
  assert.equal(parseLooseDate('31/02/2027'), null);
  assert.equal(parseLooseDate('בקרוב'), null);
  assert.equal(parseLooseDate(''), null);
});

test('a guest count out of whatever somebody typed', () => {
  assert.equal(parseLooseCount('about 250 guests'), 250);
  assert.equal(parseLooseCount('כ-350'), 350);
  assert.equal(parseLooseCount('250-300'), 250);
  assert.equal(parseLooseCount('99999'), 1500);
  assert.equal(parseLooseCount('הרבה'), null);
});

test('a source name folds to one spelling', () => {
  /* 'Instagram Lead Ad!!' folded to a slug with a trailing underscore, which
     is a different row in a report from the same slug without one. */
  assert.equal(slugSource('Instagram Lead Ad!!'), 'instagram_lead_ad');
  assert.equal(slugSource('  Google Ads  '), 'google_ads');
  assert.equal(slugSource('!!!'), 'webhook');
  assert.equal(slugSource(''), 'webhook');
});

test('a payload with nothing in it yields nothing, rather than guesses', () => {
  const lead = readLead({ hello: 'world' }, 'webhook');
  assert.deepEqual([lead.full_name, lead.phone, lead.email], ['', '', '']);
});
