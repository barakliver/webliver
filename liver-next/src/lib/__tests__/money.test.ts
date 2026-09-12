import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ils, parseIls, sumIls, toAgorot, MONEY_INPUT } from '../money.ts';

/* The reported defect, end to end: a deposit of 1,250.50 typed into a form,
   parsed, stored as the database would store it, added to a total, and
   written back onto the screen. Every step used to lose the agorot at one
   point or another — the field refused the value, and the formatter rounded
   whatever did get through. */
test('1,250.50 survives the keyboard, the total and the screen', () => {
  const typed = parseIls('1250.50');
  assert.equal(typed, 1250.5);
  assert.equal(ils(typed), '₪1,250.50');

  const total = sumIls([typed, 2000, 749.5]);
  assert.equal(total, 4000);
  assert.equal(ils(total), '₪4,000');
});

test('a whole amount carries no decimals, which is what the screen wanted', () => {
  assert.equal(ils(125500), '₪125,500');
  assert.equal(ils(0), '₪0');
  assert.equal(ils(1250.5), '₪1,250.50');
  assert.equal(ils(1250.05), '₪1,250.05');
});

test('the sign goes in front of the currency, not inside it', () => {
  assert.equal(ils(-125500), '-₪125,500');
  assert.equal(ils(-1250.5), '-₪1,250.50');
  /* Rounds to zero, so it is zero rather than minus zero. */
  assert.equal(ils(-0.001), '₪0');
});

test('a column of amounts adds up to what the rows say', () => {
  /* The float that made this necessary: these three as ordinary addition
     give 0.30000000000000004, and a balance built that way never settles. */
  assert.equal(sumIls([0.1, 0.2]), 0.3);
  assert.equal(sumIls([]), 0);
  assert.equal(sumIls([19.99, 0.01]), 20);
  /* And the case the couple actually hits: three deposits with agorot that
     should leave nothing owing. */
  const payments = [1250.5, 3749.25, 5000.25];
  assert.equal(sumIls(payments), 10000);
  assert.equal(sumIls(payments) === 10000, true);
});

test('what a person types is read the way they meant it', () => {
  assert.equal(parseIls('1,250.50'), 1250.5);
  assert.equal(parseIls('₪1,250.50'), 1250.5);
  assert.equal(parseIls(' 1250.5 '), 1250.5);
  assert.equal(parseIls('-40'), -40);
  assert.equal(parseIls(1250.5), 1250.5);
  /* A third decimal cannot come back later as a rounding surprise: the
     column is numeric(12,2) and this agrees with it on the way in. */
  assert.equal(parseIls('1250.509'), 1250.51);
  assert.equal(parseIls(''), null);
  assert.equal(parseIls('abc'), null);
  assert.equal(parseIls('.'), null);
  assert.equal(parseIls(null), null);
});

test('agorot are whole numbers, so nothing downstream has to trust a float', () => {
  assert.equal(toAgorot(1250.5), 125050);
  assert.equal(toAgorot(0.1 + 0.2), 30);
  assert.equal(toAgorot(null), 0);
});

/* The attributes are asserted rather than described, because the defect was
   an absent attribute and a comment would not have caught it. */
test('a money field accepts agorot and offers a decimal point to type them', () => {
  assert.equal(MONEY_INPUT.step, '0.01');
  assert.equal(MONEY_INPUT.inputMode, 'decimal');
  assert.equal(MONEY_INPUT.type, 'number');
});
