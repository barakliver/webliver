import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBar, shoppingList, DEFAULT_PRICES } from '../bar.ts';

const wedding = { guests: 250, childrenPct: 10, drinkersPct: 70 };
const evening = { hours: 5, style: 'classic' as const, season: 'summer' as const };

test('children are counted as guests and never as drinkers', () => {
  const p = planBar(wedding, evening);
  assert.equal(p.children, 25);
  /* 225 adults, 70% of them */
  assert.equal(p.drinkers, 158);
  /* and they still drink something: soft drinks are per guest, not per adult */
  assert.ok(p.softLitres > 0);
});

test('the first hour is charged once, not every hour', () => {
  /* People arrive thirsty and then settle. Treating every hour the same either
     overbuys the night or leaves the bar dry at the reception. */
  const one = planBar(wedding, { ...evening, hours: 1 }).servings;
  const two = planBar(wedding, { ...evening, hours: 2 }).servings;
  const three = planBar(wedding, { ...evening, hours: 3 }).servings;
  assert.equal(two - one, three - two);
  assert.equal(one, planBar(wedding, { ...evening, hours: 1 }).drinkers * 2);
});

test('a bar that is not open buys nothing to drink', () => {
  const p = planBar(wedding, { ...evening, hours: 0 });
  assert.equal(p.servings, 0);
  assert.equal(p.bottles.vodka, 0);
  assert.equal(p.softLitres, 0);
  /* Ice is per guest rather than per hour, so it survives. That is correct:
     the fish and the bottles need it whether or not anybody drinks. */
  assert.ok(p.iceKg > 0);
});

test('the style moves what is bought, not how much', () => {
  const classic = planBar(wedding, { ...evening, style: 'classic' });
  const spirits = planBar(wedding, { ...evening, style: 'spirits' });
  const beer = planBar(wedding, { ...evening, style: 'beer' });

  assert.equal(classic.servings, spirits.servings);
  assert.ok(spirits.bottles.vodka > classic.bottles.vodka);
  assert.ok(beer.bottles.beer > classic.bottles.beer);
  assert.ok(beer.bottles.vodka < classic.bottles.vodka);
});

test('summer is not a small adjustment to ice', () => {
  const summer = planBar(wedding, { ...evening, season: 'summer' });
  const winter = planBar(wedding, { ...evening, season: 'winter' });
  assert.ok(summer.iceKg > winter.iceKg * 2);
  assert.ok(summer.softLitres > winter.softLitres);
});

test('nothing comes back fractional, because nobody buys a third of a bottle', () => {
  const p = planBar({ guests: 137, childrenPct: 7, drinkersPct: 63 }, { hours: 4.5, style: 'wine', season: 'mild' });
  for (const n of [...Object.values(p.bottles), p.softLitres, p.iceKg, p.citrus, p.cups]) {
    assert.equal(Number.isInteger(n), true, `${n} is not a whole number`);
  }
});

test('an empty or nonsensical crowd yields nothing rather than NaN', () => {
  for (const crowd of [
    { guests: 0, childrenPct: 0, drinkersPct: 70 },
    { guests: 100, childrenPct: 200, drinkersPct: 70 },
    { guests: 100, childrenPct: -50, drinkersPct: 70 },
    { guests: 100, childrenPct: 10, drinkersPct: Number.NaN },
  ]) {
    const p = planBar(crowd, evening);
    for (const n of [p.drinkers, p.servings, p.iceKg, ...Object.values(p.bottles)]) {
      assert.equal(Number.isFinite(n), true, 'a figure came back as NaN');
      assert.ok(n >= 0, 'a figure came back negative');
    }
  }
});

test('the shopping list only lists what is actually needed', () => {
  const p = planBar(wedding, { ...evening, style: 'beer' });
  const { lines, total } = shoppingList(p, DEFAULT_PRICES);
  assert.ok(lines.every((l) => l.qty > 0));
  assert.equal(total, lines.reduce((s, l) => s + l.total, 0));
  assert.ok(total > 0);
});

test('a missing price is zero rather than NaN across the whole total', () => {
  /* One blank field would otherwise make the entire estimate read NaN, which
     looks like a broken app rather than a price nobody filled in. */
  const p = planBar(wedding, evening);
  const { total } = shoppingList(p, { ...DEFAULT_PRICES, vodka: Number.NaN });
  assert.equal(Number.isFinite(total), true);
  assert.ok(total > 0);
});

test('his own rule: a litre for every nine people', () => {
  /* From his spreadsheet: 300 guests, no children, comes to 33.3 litres. That
     number is the one he has bought against, so it is the one to match. */
  const p = planBar({ guests: 300, childrenPct: 0, drinkersPct: 70 },
    { hours: 5, style: 'barak', season: 'summer' });
  assert.equal(p.litres, 33.3);
});

test('his split is his, in litres', () => {
  const p = planBar({ guests: 270, childrenPct: 0, drinkersPct: 70 },
    { hours: 5, style: 'barak', season: 'summer' });
  /* 30 litres: beer and wine 9 each, vodka/campari/tequila 3 each,
     whiskey and rum 1.5 each. Beer at a third of a litre a bottle. */
  assert.equal(p.litres, 30);
  assert.equal(p.bottles.beer, Math.ceil(9 / 0.33));
  assert.equal(p.bottles.wine, Math.ceil(9 / 0.75));
  assert.equal(p.bottles.vodka, Math.ceil(3 / 0.75));
  assert.equal(p.bottles.whiskey, Math.ceil(1.5 / 0.75));
  /* Three bottles the serving model never knew about. */
  assert.ok(p.bottles.campari > 0 && p.bottles.tequila > 0 && p.bottles.rum > 0);
});

test('his rule does not care how long the bar is open', () => {
  /* Which is the point of it: the hours are already inside the number he
     buys against. The serving model is the one that answers that question. */
  const crowd = { guests: 200, childrenPct: 5, drinkersPct: 70 };
  const short = planBar(crowd, { hours: 3, style: 'barak', season: 'mild' });
  const long = planBar(crowd, { hours: 9, style: 'barak', season: 'mild' });
  assert.equal(short.litres, long.litres);
  /* Soft drinks still do, because thirst is not the same thing as drink. */
  assert.ok(long.softLitres > short.softLitres);
});

test('children are outside his litres', () => {
  const none = planBar({ guests: 300, childrenPct: 0, drinkersPct: 70 },
    { hours: 5, style: 'barak', season: 'mild' });
  const some = planBar({ guests: 300, childrenPct: 20, drinkersPct: 70 },
    { hours: 5, style: 'barak', season: 'mild' });
  assert.ok(some.litres < none.litres);
  /* And still drink: soft is per guest. */
  assert.equal(some.softLitres, none.softLitres);
});

test('the serving model leaves his three bottles at zero rather than guessing', () => {
  const p = planBar({ guests: 200, childrenPct: 10, drinkersPct: 70 },
    { hours: 5, style: 'classic', season: 'mild' });
  assert.equal(p.bottles.campari, 0);
  assert.equal(p.bottles.tequila, 0);
  assert.equal(p.bottles.rum, 0);
  assert.ok(p.litres > 0);
});
