import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easter, holidaysOn, holidaysRange, type Holiday } from '../holidays.ts';
import { hebrewOf } from '../hebrewDate.ts';

const keysOn = (date: string) => holidaysOn(date).map((h) => h.key);
const year = (y: number) => holidaysRange(`${y}-01-01`, y % 4 === 0 ? 366 : 365);
const of = (rows: Holiday[], key: string) => rows.filter((h) => h.key === key);

test('Easter lands where every almanac says it does', () => {
  assert.equal(easter(2024), '2024-03-31');
  assert.equal(easter(2025), '2025-04-20');
  assert.equal(easter(2026), '2026-04-05');
  assert.equal(easter(2027), '2027-03-28');
  assert.equal(easter(2038), '2038-04-25');
});

test('the movable feasts are counted from Easter', () => {
  assert.ok(keysOn('2026-04-03').includes('goodFriday'));
  assert.ok(keysOn('2026-04-05').includes('easter'));
  assert.ok(keysOn('2026-02-18').includes('ashWednesday'));
  assert.ok(keysOn('2026-05-14').includes('ascension'));
  assert.ok(keysOn('2026-05-24').includes('pentecost'));
});

test('the fixed feasts are fixed', () => {
  assert.ok(keysOn('2026-12-25').includes('christmas'));
  assert.ok(keysOn('2026-12-24').includes('christmasEve'));
  assert.ok(keysOn('2027-01-01').includes('newYear'));
  assert.ok(keysOn('2027-01-06').includes('epiphany'));
});

test('a Jewish festival falls on its Hebrew date, whatever the Gregorian one is', () => {
  /* Read the Hebrew date back rather than trusting a memorised table. */
  for (const y of [2025, 2026, 2027, 2028]) {
    const rows = year(y);
    for (const h of of(rows, 'yomKippur')) assert.deepEqual([hebrewOf(h.date).month, hebrewOf(h.date).day], ['Tishri', 10]);
    for (const h of of(rows, 'pesach')) assert.deepEqual([hebrewOf(h.date).month, hebrewOf(h.date).day], ['Nisan', 15]);
    for (const h of of(rows, 'shavuot')) assert.deepEqual([hebrewOf(h.date).month, hebrewOf(h.date).day], ['Sivan', 6]);
    for (const h of of(rows, 'purim')) assert.equal(hebrewOf(h.date).day, 14);
  }
});

test('Rosh Hashana is two days and the second is not labelled again', () => {
  const rows = of(year(2026), 'roshHashana');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.first), [true, false]);
});

test('Hanukkah is exactly eight days, in a 29-day Kislev and a 30-day one', () => {
  /* 5786 (winter 2025) and 5787 (winter 2026) differ in Kislev's length
     across the years around now; eight days either way is the whole point
     of counting rather than listing. */
  for (const y of [2024, 2025, 2026, 2027, 2028, 2029]) {
    const rows = of(holidaysRange(`${y}-11-15`, 60), 'hanukkah');
    assert.equal(rows.length, 8, `Hanukkah ${y}`);
    assert.equal(rows.filter((r) => r.first).length, 1);
  }
});

test('Independence Day never falls on Friday, Saturday or Monday, and Memorial Day is the day before', () => {
  for (const y of [2024, 2025, 2026, 2027, 2028, 2029, 2030]) {
    const rows = year(y);
    const [atz] = of(rows, 'yomHaatzmaut');
    const [zik] = of(rows, 'yomHazikaron');
    assert.ok(atz && zik, `both exist in ${y}`);
    const wd = new Date(`${atz.date}T12:00:00Z`).getUTCDay();
    assert.ok(![5, 6, 1].includes(wd), `Yom HaAtzmaut ${y} is on weekday ${wd}`);
    const prev = new Date(`${atz.date}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    assert.equal(zik.date, prev.toISOString().slice(0, 10));
  }
});

test('Holocaust Remembrance Day is never on Friday or Sunday', () => {
  for (const y of [2024, 2025, 2026, 2027, 2028, 2029, 2030]) {
    const [d] = of(year(y), 'yomHashoah');
    assert.ok(d, `exists in ${y}`);
    const wd = new Date(`${d.date}T12:00:00Z`).getUTCDay();
    assert.ok(wd !== 5 && wd !== 0, `Yom HaShoah ${y} on weekday ${wd}`);
  }
});

test('a plain day has no holiday at all', () => {
  assert.deepEqual(keysOn('2026-08-11'), []);
});

test('both families answer at once, so the switches on the screen cannot drift', () => {
  /* 2027-01-01: New Year on the civil calendar and, that year, nothing
     Jewish. The list carries the family so the screen can filter. */
  const rows = holidaysOn('2027-01-01');
  assert.ok(rows.some((r) => r.family === 'christian'));
  assert.ok(rows.every((r) => r.family === 'christian' || r.family === 'jewish'));
});
