import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteTitle, NOTE_LIMIT } from '../../content/meetings.ts';

test('a page is named after its first line', () => {
  assert.equal(noteTitle('פגישת הפקה עם נועה ואיתי\nהאולם סגור\nהצלם עוד לא'), 'פגישת הפקה עם נועה ואיתי');
});

test('a title somebody typed wins over the first line', () => {
  assert.equal(noteTitle('פגישת הפקה\nעוד דברים', 'סיכום מול האולם'), 'סיכום מול האולם');
  /* Whitespace is not a title. */
  assert.equal(noteTitle('פגישת הפקה', '   '), 'פגישת הפקה');
});

test('blank lines at the top are skipped rather than named', () => {
  assert.equal(noteTitle('\n\n   \nהתחלנו לדבר על התקציב'), 'התחלנו לדבר על התקציב');
});

test('a page with nothing on it has no name', () => {
  assert.equal(noteTitle(''), '');
  assert.equal(noteTitle('\n   \n'), '');
});

test('a long first line is cut on a word, with an ellipsis', () => {
  const long = 'ישבנו עם נועה ואיתי ועברנו על כל מה שנשאר לסגור לקראת החתונה בדצמבר וגם על התקציב';
  const out = noteTitle(long);
  assert.ok(out.length <= 81, 'stays short enough to read in a list');
  assert.ok(out.endsWith('…'), 'says it was cut');
  assert.ok(!out.slice(0, -1).endsWith(' '), 'no space left hanging before the ellipsis');
  assert.ok(long.startsWith(out.slice(0, -1)), 'what is shown is what was written');
});

test('a long first line with no spaces is still cut', () => {
  const out = noteTitle('א'.repeat(200));
  assert.equal(out.length, 81);
  assert.ok(out.endsWith('…'));
});

test('a typed title is capped too, so the column never refuses the save', () => {
  assert.equal(noteTitle('', 'ב'.repeat(500)).length, 200);
});

test('the page holds what the column holds', () => {
  assert.equal(NOTE_LIMIT, 20000);
});
