import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, formatDate, daysUntil, isOverdue } from '../dates.ts';

const fmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

test('nothing usable comes back as null rather than as an Invalid Date', () => {
  for (const v of [null, undefined, '', 'בקרוב', 'not-a-date', NaN]) {
    assert.equal(parseDate(v as never), null, `${String(v)} should not parse`);
  }
});

test('a real date parses', () => {
  assert.equal(parseDate('2027-08-14')?.toISOString().slice(0, 10), '2027-08-14');
  assert.equal(parseDate(new Date('2027-08-14'))?.getUTCFullYear(), 2027);
});

test('formatting never throws, whatever it is handed', () => {
  /* Intl.format does not return "Invalid Date" the way toString does. It
     throws RangeError, and thrown during a server render that is a blank page
     from one unexpected row. */
  assert.doesNotThrow(() => formatDate(fmt, 'garbage', '—'));
  assert.equal(formatDate(fmt, 'garbage', '—'), '—');
  assert.equal(formatDate(fmt, null, 'טרם נקבע'), 'טרם נקבע');
  assert.equal(formatDate(fmt, '2027-08-14', '—').includes('2027'), true);
});

test('a countdown is counted on calendar dates', () => {
  const from = new Date('2027-08-10T23:30:00Z');
  assert.equal(daysUntil('2027-08-14', from), 4);
  assert.equal(daysUntil('2027-08-10', from), 0);
  assert.equal(daysUntil('2027-08-09', from), -1);
});

test('no date is not zero days', () => {
  assert.equal(daysUntil(null), null);
  assert.equal(daysUntil('nonsense'), null);
});

test('today is not late, and undated is not late', () => {
  const from = new Date('2027-08-10T23:30:00Z');
  assert.equal(isOverdue('2027-08-10', from), false);
  assert.equal(isOverdue('2027-08-09', from), true);
  assert.equal(isOverdue(null, from), false);
  assert.equal(isOverdue('nonsense', from), false);
});
