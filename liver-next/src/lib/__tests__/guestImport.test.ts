import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readGuestLine, readGuestList, readGuestCsv, dedupe, phoneKey,
} from '../guestImport.ts';

/**
 * This file had no tests at all, and it is nothing but judgement: which line
 * is a header, which run of digits is a phone and which is how many of them
 * are coming, who is the same person twice. Every one of those decisions
 * produces a guest list that looks correct on the screen whether or not it
 * is, which is exactly the kind of thing that has to be asserted rather than
 * looked at.
 */

/** Shorthand: a line that is expected to read. */
function one(line: string) {
  const got = readGuestLine(line);
  assert.ok(!('reason' in got), `${line} was skipped: ${(got as { reason?: string }).reason}`);
  return got as Exclude<typeof got, { reason: string }>;
}

test('a phone comes out of the line wherever somebody put it', () => {
  assert.equal(one('דני כהן 050-1234567').phone, '050-1234567');
  assert.equal(one('050-1234567 דני כהן').phone, '050-1234567');
  assert.equal(one('דני כהן - 0501234567').phone, '0501234567');
  assert.equal(one('דני כהן +972 50 123 4567').phone, '+972 50 123 4567');
  assert.equal(one('משה 03-1234567').phone, '03-1234567');
  /* And the name is what is left, with the separator that was holding them
     apart taken off it. */
  assert.equal(one('דני כהן - 0501234567').name, 'דני כהן');
  assert.equal(one('050-1234567 דני כהן').name, 'דני כהן');
});

test('a small number beside a name is how many of them, not a phone', () => {
  /* The failure this is here for: a pattern that matches any run of digits
     eats the count, and a pattern anchored on the phone prefix does not. */
  assert.equal(one('משפחת לוי 4').phone, '');
  assert.equal(one('משפחת לוי 4').party, 4);
  assert.equal(one('משפחת לוי 4').name, 'משפחת לוי');
});

test('the phone is taken before the count, because a phone ends in digits', () => {
  /* Run them the other way round and the last two digits of every number
     become a party of sixty-seven. */
  const g = one('דני כהן 0501234567');
  assert.equal(g.phone, '0501234567');
  assert.equal(g.party, 1);

  const both = one('דני כהן 050-1234567 +2');
  assert.equal(both.phone, '050-1234567');
  assert.equal(both.party, 3);
  assert.equal(both.name, 'דני כהן');
});

test('a plus is one more and everything else is how many altogether', () => {
  assert.equal(one('דני +2').party, 3);
  assert.equal(one('משפחת לוי x4').party, 4);
  assert.equal(one('שרה ודני (2)').party, 2);
  assert.equal(one('משפחת כהן 6 אנשים').party, 6);
  assert.equal(one('יעל כהן 2').party, 2);
  assert.equal(one('שרה אברהם').party, 1);
});

test('a number with nothing in front of it is not a party of anything', () => {
  /* Taking it would leave a guest with no name and a reason nobody can act
     on, which is worse than leaving the line alone. */
  assert.deepEqual(readGuestLine('4'), { reason: 'שם קצר מדי' });
  assert.deepEqual(readGuestLine('0501112222'), { reason: 'מספר בלי שם' });
  assert.deepEqual(readGuestLine('א'), { reason: 'שם קצר מדי' });
  assert.deepEqual(readGuestLine('   '), { reason: 'שורה ריקה' });
});

test('a count stays inside the name when it could not be one', () => {
  /* Capped at twenty, because a guest list says "משפחת לוי 4" constantly and
     never "משפחת לוי 400". */
  const g = one('קבוצה 400');
  assert.equal(g.party, 1);
  assert.equal(g.name, 'קבוצה 400');
});

test('a date and a long number are not phones', () => {
  assert.equal(one('חתונה 01/05/2026').phone, '');
  assert.equal(one('דני 2050').phone, '');
});

test('the side comes off the end when somebody wrote it there', () => {
  const g = one('יוסי ומיכל מזרחי - 052 999 8877 - חתן');
  assert.equal(g.side, 'חתן');
  assert.equal(g.phone, '052 999 8877');
  assert.equal(g.name, 'יוסי ומיכל מזרחי');
  assert.equal(one('שרה לוי - bride').side, 'כלה');

  /* And in the other order, which leaves the separator the phone was sitting
     behind dangling at the end of the line. */
  const other = one('יוסי ומיכל מזרחי - חתן - 052 999 8877');
  assert.equal(other.side, 'חתן');
  assert.equal(other.name, 'יוסי ומיכל מזרחי');
});

test('a bullet or a numbering is a list and not part of a name', () => {
  assert.equal(one('1. דני כהן').name, 'דני כהן');
  assert.equal(one('- משפחת לוי').name, 'משפחת לוי');
  assert.equal(one('• שרה').name, 'שרה');
});

test('a table is read as a table and prose is read line by line', () => {
  /* The whole bug this exists for: the list a couple actually pastes is four
     one-column rows, and read as a table every phone and every count ends up
     inside the name. It imports, nothing is reported, and the couple gets
     guests called "דני כהן 050-1234567". */
  const pasted = readGuestList('דני כהן 050-1234567\nמשפחת לוי 4\nשרה אברהם');
  assert.deepEqual(pasted.rows.map((r) => r.name), ['דני כהן', 'משפחת לוי', 'שרה אברהם']);
  assert.equal(pasted.rows[0].phone, '050-1234567');
  assert.equal(pasted.rows[1].party, 4);

  const sheet = readGuestList('שם מלא,טלפון,צד,כמות\nדני כהן,0501234567,חתן,2');
  assert.deepEqual(sheet.rows, [{ name: 'דני כהן', side: 'חתן', phone: '0501234567', party: 2 }]);
});

test('a header is read as a header and a first guest is not eaten', () => {
  const headed = readGuestCsv('שם מלא,טלפון\nדני כהן,0501234567');
  assert.equal(headed.rows.length, 1);
  /* No recognisable header means the first line is somebody's first guest. */
  const bare = readGuestCsv('דני כהן,0501234567\nשרה לוי,0542223333');
  assert.equal(bare.rows.length, 2);
  assert.equal(bare.rows[0].name, 'דני כהן');
});

test('an unusable line is reported with the number somebody can count down to', () => {
  const { rows, skipped } = readGuestList('דני כהן\n\nא\n0501112222');
  assert.equal(rows.length, 1);
  assert.deepEqual(skipped.map((s) => s.line), [3, 4]);
});

test('the same number written four ways is one person', () => {
  for (const p of ['050-123-4567', '050 123 4567', '+972501234567', '972-50-1234567']) {
    assert.equal(phoneKey(p), '0501234567', p);
  }
});

test('sending the spreadsheet again adds the four new names and nothing else', () => {
  /* The wrong answer to a normal accident is a four hundred person list that
     becomes eight hundred. */
  const rows = readGuestList('דני כהן 0501234567\nשרה לוי 0542223333\nיעל חדשה 0533334444').rows;
  const { fresh, duplicates } = dedupe(rows, [
    { full_name: 'דני כהן', phone: '050-123-4567' },
    { full_name: 'שרה לוי', phone: null },
  ]);
  assert.equal(duplicates, 1, 'the phone match');
  assert.deepEqual(fresh.map((r) => r.name), ['שרה לוי', 'יעל חדשה']);
});

test('the ones set aside come back by name, not only as a number', () => {
  /* The rule has one way to be wrong, and its price is a guest who silently
     never arrives on the list. A count cannot be checked against anything. */
  const rows = readGuestList('דני כהן\nשרה לוי 0542223333').rows;
  const { repeated, duplicates } = dedupe(rows, [{ full_name: 'דני כהן', phone: null }]);
  assert.equal(duplicates, 1);
  assert.deepEqual(repeated.map((r) => r.name), ['דני כהן']);
});

test('two cousins with the same name and different numbers are two guests', () => {
  /* Phone is the identity where there is one. Collapsing them would quietly
     lose a guest, which is the one import failure nobody notices until the
     seating plan. */
  const rows = readGuestList('דני כהן 0501111111\nדני כהן 0502222222').rows;
  const { fresh, duplicates } = dedupe(rows, []);
  assert.equal(duplicates, 0);
  assert.equal(fresh.length, 2);
});

test('the same name twice with no number at all is one guest', () => {
  const rows = readGuestList('דני כהן\nדני כהן').rows;
  assert.equal(dedupe(rows, []).duplicates, 1);
});
