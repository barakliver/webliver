import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hebrewOf, hebrewEveningOf, omerDay, rule, ruleRange } from '../hebrewDate.ts';

/**
 * The dates a producer must not offer, and the ones they must not refuse.
 *
 * Every case is a real date checked against the Hebrew calendar rather than
 * against the implementation. A wrong answer here costs a booked hall, so the
 * fixed points of the year are all pinned: the start of the Three Weeks,
 * Tisha B'Av, the first night of Pesach, Lag BaOmer, Rosh Hashanah, and a
 * leap year's second Adar.
 */

test('the conversion lands on the fixed points of the year', () => {
  assert.deepEqual(hebrewOf('2026-07-02'), { year: 5786, month: 'Tamuz', day: 17 });
  assert.deepEqual(hebrewOf('2026-07-23'), { year: 5786, month: 'Av', day: 9 });
  assert.deepEqual(hebrewOf('2026-04-02'), { year: 5786, month: 'Nisan', day: 15 });
  assert.deepEqual(hebrewOf('2026-05-05'), { year: 5786, month: 'Iyar', day: 18 });
  assert.deepEqual(hebrewOf('2026-09-12'), { year: 5787, month: 'Tishri', day: 1 });
});

test('a leap year has two Adars and Purim keeps the second', () => {
  const h = hebrewOf('2027-03-23');
  assert.equal(h.month, 'Adar II', 'ICU names the second Adar');
  assert.equal(rule('2027-03-22').reasons.includes('purim'), true, 'the evening of 14 Adar II');
});

test('the evening belongs to the day that is beginning', () => {
  /* A wedding is an evening event, and the Hebrew day turns at sunset. The
     evening of 1 July is already the 17th of Tammuz. */
  assert.deepEqual(hebrewEveningOf('2026-07-01'), { year: 5786, month: 'Tamuz', day: 17 });
  assert.deepEqual(hebrewOf('2026-07-01'), { year: 5786, month: 'Tamuz', day: 16 });
});

test('Friday evening is Shabbat and Saturday evening is not', () => {
  /* The single most-used wedding slot in the country is Saturday night, and
     a calendar that greys it out is a calendar nobody will trust. */
  const friday = rule('2026-06-05');
  assert.equal(new Date('2026-06-05T12:00:00Z').getUTCDay(), 5, 'the fixture really is a Friday');
  assert.equal(friday.verdict, 'blocked');
  assert.ok(friday.reasons.includes('shabbat'));

  const saturday = rule('2026-06-06');
  assert.equal(saturday.verdict, 'clear', 'motzaei Shabbat is open');
  assert.equal(saturday.reasons.length, 0);
});

test('the Three Weeks are closed from the seventeenth of Tammuz', () => {
  assert.equal(rule('2026-06-30').verdict, 'clear', 'the evening before is still open');
  const first = rule('2026-07-01');
  assert.equal(first.verdict, 'blocked');
  assert.ok(first.reasons.includes('threeWeeks'));
  assert.ok(rule('2026-07-19').reasons.includes('nineDays'), 'Rosh Chodesh Av is stricter');
  assert.ok(rule('2026-07-22').reasons.includes('tishaBav'));
});

test('the Omer closes the spring, and Lag BaOmer opens one night in it', () => {
  assert.equal(omerDay({ year: 5786, month: 'Nisan', day: 16 }), 1);
  assert.equal(omerDay({ year: 5786, month: 'Iyar', day: 18 }), 33, 'Lag BaOmer is the 33rd');
  assert.equal(omerDay({ year: 5786, month: 'Sivan', day: 5 }), 49);
  assert.equal(omerDay({ year: 5786, month: 'Av', day: 1 }), 0, 'and nothing outside it');

  /* The evening of 4 May begins 18 Iyar: Lag BaOmer, and one of the busiest
     wedding nights of the year. */
  const lag = rule('2026-05-04');
  assert.ok(lag.reasons.includes('lagBaomer'));
  assert.equal(lag.verdict, 'clear');

  const mourning = rule('2026-04-26');
  assert.equal(mourning.verdict, 'blocked');
  assert.ok(mourning.reasons.includes('omer'));
});

test('after Lag BaOmer the Sephardi custom still differs, so it is a date to check', () => {
  const between = rule('2026-05-06');
  assert.equal(between.verdict, 'check');
  assert.ok(between.reasons.includes('omerSephardi'));
});

test('the festivals and their eves', () => {
  assert.ok(rule('2026-09-11').reasons.includes('roshHashana'), 'the evening of 1 Tishri');
  assert.ok(rule('2026-09-20').reasons.includes('yomKippur'));
  assert.ok(rule('2026-04-01').reasons.includes('pesach'), 'the first night');
  assert.ok(rule('2026-04-03').reasons.includes('cholHamoed'));
  assert.ok(rule('2026-05-21').reasons.includes('shavuot'));
  for (const d of ['2026-09-11', '2026-09-20', '2026-04-01', '2026-05-21']) {
    assert.equal(rule(d).verdict, 'blocked', `${d} should be blocked`);
  }
});

test('an ordinary Tuesday in the autumn is simply clear', () => {
  const t = rule('2026-11-10');
  assert.equal(t.verdict, 'clear');
  assert.equal(t.reasons.length, 0);
});

test('a range comes back one row per day, in order, with no gaps', () => {
  const days = ruleRange('2026-06-28', 30);
  assert.equal(days.length, 30);
  assert.equal(days[0].date, '2026-06-28');
  assert.equal(days[29].date, '2026-07-27');
  /* Crossing a month boundary is where an off-by-one would show. */
  assert.equal(days[3].date, '2026-07-01');
  assert.ok(days.every((d) => d.hebrew.day >= 1 && d.hebrew.day <= 30));
});
