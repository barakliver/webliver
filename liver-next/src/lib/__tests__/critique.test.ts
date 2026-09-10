import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, areaOfTag, areaOfLine, isProTag, isConTag, isStyle, isCategory, type CritiqueLog } from '../../content/critique.ts';

const log = (over: Partial<CritiqueLog> & { id: string }): CritiqueLog => ({
  venue_name: 'גני ורדים', event_date: '2026-06-01', style: 'garden',
  pros: [], cons: [], pros_note: '', cons_note: '', takeaways: '', photos: [],
  ...over,
});

test('a tag lands on the area of their own evening it is about', () => {
  assert.equal(areaOfTag('barQueue'), 'bar');
  assert.equal(areaOfTag('foodCold'), 'catering');
  assert.equal(areaOfTag('musicTooLoud'), 'design');
  assert.equal(areaOfTag('startedLate'), 'timing');
  assert.equal(areaOfTag('somethingNobodyShipped'), 'other');
});

test('the lists know their own keys and nothing else', () => {
  assert.ok(isProTag('barFast') && !isProTag('barQueue'));
  assert.ok(isConTag('barQueue') && !isConTag('barFast'));
  assert.ok(isStyle('fridayNoon') && !isStyle('spaceship'));
  assert.ok(isCategory('vendors') && !isCategory('gossip'));
});

test('two weddings that both queued at the bar count it twice, in one line', () => {
  const rows = summarise([
    log({ id: 'a', cons: ['barQueue'] }),
    log({ id: 'b', cons: ['barQueue', 'foodCold'] }),
  ]);
  const bar = rows.find((r) => r.area === 'bar')!;
  assert.deepEqual(bar.cons, [{ key: 'barQueue', n: 2 }]);
  const catering = rows.find((r) => r.area === 'catering')!;
  assert.deepEqual(catering.cons, [{ key: 'foodCold', n: 1 }]);
});

test('a line about the bar is read under the bar, not under everything the wedding was tagged for', () => {
  const rows = summarise([
    log({ id: 'a', venue_name: 'אחוזת הכפר', cons: ['barQueue'], pros: ['foodGood'], takeaways: 'שני ברמנים, לא אחד' }),
  ]);
  const bar = rows.find((r) => r.area === 'bar')!;
  const catering = rows.find((r) => r.area === 'catering')!;
  assert.deepEqual(bar.takeaways, [{ venue: 'אחוזת הכפר', line: 'שני ברמנים, לא אחד' }]);
  assert.deepEqual(catering.takeaways, [], 'the catering heading does not collect a sentence about the bar');
});

test('a line names its own area, in either language, or names none', () => {
  assert.equal(areaOfLine('להוריד את המוזיקה בזמן האוכל'), 'catering');
  assert.equal(areaOfLine('two bartenders, not one'), 'bar');
  assert.equal(areaOfLine('לכתוב בהזמנה שעה שהיא באמת השעה'), 'timing');
  assert.equal(areaOfLine('לדבר עם ההורים'), null);
});

test('a Hebrew word is matched as a word, prefixes and all', () => {
  /* בהזמנה contains מנה, and הזמנות contains מנות. Substring matching
     filed both of these under catering. */
  assert.equal(areaOfLine('לכתוב בהזמנה שעה שהיא באמת השעה'), 'timing');
  assert.equal(areaOfLine('לשלוח את ההזמנות בזמן'), 'timing');
  /* And the prefix itself does not stop a real match. */
  assert.equal(areaOfLine('להוריד את המוזיקה'), 'design');
  assert.equal(areaOfLine('לבדוק שיש מספיק אוכל'), 'catering');
});

test('a line that names no area falls back to what the wedding was tagged for', () => {
  const rows = summarise([log({ id: 'a', cons: ['barQueue'], pros: ['ranOnTime'], takeaways: 'לדבר עם ההורים' })]);
  assert.deepEqual(rows.map((r) => r.area).sort(), ['bar', 'timing']);
  assert.equal(rows.find((r) => r.area === 'bar')!.takeaways.length, 1);
});

test('several lines in one takeaway are several lines, and blanks are dropped', () => {
  const rows = summarise([log({ id: 'a', cons: ['barQueue'], takeaways: 'שני ברמנים\n\n  בר שני בגינה  ' })]);
  const bar = rows.find((r) => r.area === 'bar')!;
  assert.deepEqual(bar.takeaways.map((t) => t.line), ['שני ברמנים', 'בר שני בגינה']);
});

test('two lines from one wedding can land under two different areas', () => {
  const rows = summarise([log({ id: 'a', cons: ['barQueue'], takeaways: 'שני ברמנים\nלכתוב שעה אמיתית בהזמנה' })]);
  assert.deepEqual(rows.find((r) => r.area === 'bar')!.takeaways.map((t) => t.line), ['שני ברמנים']);
  assert.deepEqual(rows.find((r) => r.area === 'timing')!.takeaways.map((t) => t.line), ['לכתוב שעה אמיתית בהזמנה']);
});

test('a takeaway with no tag at all still lands somewhere', () => {
  const rows = summarise([log({ id: 'a', takeaways: 'להזמין הסעות' })]);
  assert.deepEqual(rows.map((r) => r.area), ['other']);
  assert.equal(rows[0].takeaways.length, 1);
});

test('an area nobody mentioned is left out, and an empty journal is an empty summary', () => {
  const rows = summarise([log({ id: 'a', pros: ['barFast'] })]);
  assert.deepEqual(rows.map((r) => r.area), ['bar']);
  assert.deepEqual(summarise([]), []);
});

test('the areas come out in one order, whatever order the weddings were logged in', () => {
  const rows = summarise([
    log({ id: 'a', cons: ['noOneInCharge'] }),
    log({ id: 'b', cons: ['startedLate'] }),
    log({ id: 'c', pros: ['foodGood'] }),
  ]);
  assert.deepEqual(rows.map((r) => r.area), ['catering', 'timing', 'other']);
});

test('a tag the content no longer ships is dropped rather than counted', () => {
  const rows = summarise([log({ id: 'a', pros: ['barFast', 'retiredTag'], cons: ['alsoRetired'] })]);
  const bar = rows.find((r) => r.area === 'bar')!;
  assert.deepEqual(bar.pros, [{ key: 'barFast', n: 1 }]);
  assert.equal(rows.length, 1);
});
