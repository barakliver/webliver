import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReceipt } from '../receipt.ts';

/**
 * The receipt reader, checked on the readings that would do damage.
 *
 * This is the only part of the scanner that can put a wrong number in front of
 * somebody, and every case here is a way a photograph of a receipt actually
 * goes wrong: a smudged total, a decimal separator read as a thousands
 * separator, a date written the Israeli way, an image that is not a receipt.
 * The rule throughout is that a doubtful reading becomes a blank field, never
 * a plausible one.
 */

const ok = { vendor: 'קייטרינג הגליל', label: 'מנות עיקריות', amount: 18400, date: '2026-08-20', confidence: 'high' };

test('a clean receipt comes through as it was read', () => {
  const r = readReceipt(ok);
  assert.equal(r.vendor, 'קייטרינג הגליל');
  assert.equal(r.label, 'מנות עיקריות');
  assert.equal(r.amount, 18400);
  assert.equal(r.date, '2026-08-20');
  assert.equal(r.sure, true);
});

test('an amount nobody could have paid is dropped rather than filled in', () => {
  /* A comma read as a decimal point turns ₪18,400 into something with four
     extra digits. It looks like a number, it fills the field, and it is the
     one error a person scanning a row would not catch. */
  assert.equal(readReceipt({ ...ok, amount: 184_000_000 }).amount, 0);
  assert.equal(readReceipt({ ...ok, amount: -50 }).amount, 0);
  assert.equal(readReceipt({ ...ok, amount: 0 }).amount, 0);
  assert.equal(readReceipt({ ...ok, amount: Number.NaN }).amount, 0);
  assert.equal(readReceipt({ ...ok, amount: 'שמונה עשר אלף' }).amount, 0);
});

test('a total that arrives as a string is still the total', () => {
  /* The tool's schema says number, so this should not happen, and it does:
     the amount comes back as "18400" often enough to matter. Refusing it
     would blank a total that was read perfectly, for a reason that is about
     the shape of the value rather than about the receipt. What the guard is
     for is the *value* — and every dangerous value is still caught, because
     the checks run after the conversion, not before it. */
  assert.equal(readReceipt({ ...ok, amount: '18400' }).amount, 18400);
  assert.equal(readReceipt({ ...ok, amount: '18400.50' }).amount, 18400.5);
  assert.equal(readReceipt({ ...ok, amount: '' }).amount, 0);
  assert.equal(readReceipt({ ...ok, amount: '184000000' }).amount, 0);
});

test('agorot survive, and nothing beyond them does', () => {
  assert.equal(readReceipt({ ...ok, amount: 1234.567 }).amount, 1234.57);
  assert.equal(readReceipt({ ...ok, amount: 99.994 }).amount, 99.99);
});

test('a date is the shape a date has, or it is absent', () => {
  /* 20/08/2026 is how the receipt itself prints it, and it is not what a date
     column takes. Half-parsing it is how a wrong date reaches a database
     looking perfectly fine. */
  assert.equal(readReceipt({ ...ok, date: '20/08/2026' }).date, '');
  assert.equal(readReceipt({ ...ok, date: '2026-8-2' }).date, '');
  assert.equal(readReceipt({ ...ok, date: 'אתמול' }).date, '');
  assert.equal(readReceipt({ ...ok, date: '' }).date, '');
  assert.equal(readReceipt({ ...ok, date: '2026-08-20' }).date, '2026-08-20');
});

test('a doubtful reading says so, and so does one with no total', () => {
  assert.equal(readReceipt({ ...ok, confidence: 'low' }).sure, false);
  /* Confident that it could not read the total is not something to act on. */
  assert.equal(readReceipt({ ...ok, amount: 0 }).sure, false);
  assert.equal(readReceipt({ ...ok, confidence: 'maybe' }).sure, false);
});

test('a photograph that is not a receipt yields nothing at all', () => {
  const r = readReceipt({ vendor: '', label: '', amount: 0, date: '', confidence: 'low' });
  assert.deepEqual(r, { vendor: '', label: '', amount: 0, date: '', sure: false });
});

test('missing and wrongly typed fields do not throw', () => {
  const r = readReceipt({});
  assert.deepEqual(r, { vendor: '', label: '', amount: 0, date: '', sure: false });
  assert.equal(readReceipt({ vendor: 42, label: null }).vendor, '');
});

test('a supplier name is trimmed rather than allowed to run', () => {
  const long = 'א'.repeat(200);
  assert.equal(readReceipt({ ...ok, vendor: long }).vendor.length, 80);
  assert.equal(readReceipt({ ...ok, vendor: '  קייטרינג  ' }).vendor, 'קייטרינג');
});
