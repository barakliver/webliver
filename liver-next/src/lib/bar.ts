/**
 * How much drink to buy, and how much ice.
 *
 * The question a producer is actually asked is "how many bottles", and the
 * honest answer has four inputs nobody thinks to give: how many of the guests
 * drink at all, for how long the bar is open, what they drink, and how hot it
 * is. Everything here is arithmetic on those four, with the assumptions
 * written down rather than buried, because the only way anybody trusts a
 * number like this is by being able to argue with how it was reached.
 *
 * It errs high on ice and low on spirits. Running out of ice ends a bar at
 * eleven; a leftover bottle of vodka goes home with somebody.
 */

export type Crowd = {
  /** Everybody invited who is coming, children included. */
  guests: number;
  /** Roughly what share are under 18. They drink nothing alcoholic and are
   *  still thirsty, which is a real cost people forget. */
  childrenPct: number;
  /** Of the adults, how many actually drink. The default is the Israeli
   *  wedding average rather than a guess: a religious crowd is far lower, a
   *  young secular one higher, and the number moves the answer more than
   *  anything else on this form. */
  drinkersPct: number;
};

export type Party = {
  /** Hours the bar is open. Not the length of the evening: the bar usually
   *  closes before the last song. */
  hours: number;
  style: BarStyle;
  season: Season;
};

export type BarStyle = 'barak' | 'classic' | 'spirits' | 'wine' | 'beer' | 'light';

/**
 * The producer's own rule, from his spreadsheet, kept exactly as he uses it.
 *
 * One litre of drink per nine people, split by category in fixed litres. It is
 * a different shape of calculation from the serving count below: it does not
 * care how long the bar is open or how many of the crowd drink, because it was
 * built from what he actually buys for a wedding of a given size and those
 * things are already inside the number.
 *
 * Both live here on purpose. His is the one he trusts and it goes first; the
 * serving model is the one that answers "and if the bar is open two hours
 * longer". A tool that quietly replaced his arithmetic with mine would be
 * answering a question he did not ask.
 */
const LITRES_PER_PERSON = 1 / 9;

/** His split, as fractions of the total litres. Campari, tequila and rum are
 *  in his sheet and were missing from the model below, which is the sort of
 *  thing only somebody who has stocked the bar would notice. */
const BARAK_SPLIT = {
  beer: 0.30, wine: 0.30, vodka: 0.10, campari: 0.10,
  tequila: 0.10, whiskey: 0.05, rum: 0.05,
};

/** Litres per bottle, for turning his litres into something to buy. */
const BOTTLE_LITRES = { spirit: 0.75, wine: 0.75, beer: 0.33 };
export type Season = 'summer' | 'winter' | 'mild';

/** How the first hour differs from the rest. People arrive thirsty, take a
 *  drink almost immediately, and then settle to about one an hour. Treating
 *  every hour the same either overbuys badly or leaves the bar dry at the
 *  reception, which is the one hour everybody is standing at it. */
const FIRST_HOUR_DRINKS = 2;
const LATER_HOUR_DRINKS = 1;

/** What the crowd reaches for, as a share of all alcoholic drinks. These are
 *  starting points to be argued with, not measurements. */
const MIX: Record<Exclude<BarStyle, 'barak'>, { spirits: number; wine: number; beer: number }> = {
  classic: { spirits: 0.40, wine: 0.30, beer: 0.30 },
  spirits: { spirits: 0.65, wine: 0.15, beer: 0.20 },
  wine:    { spirits: 0.15, wine: 0.60, beer: 0.25 },
  beer:    { spirits: 0.20, wine: 0.20, beer: 0.60 },
  light:   { spirits: 0.20, wine: 0.50, beer: 0.30 },
};

/** How the spirits themselves split. Vodka carries most of it because most of
 *  it goes into something else. */
const SPIRIT_SPLIT = { vodka: 0.45, whiskey: 0.30, gin: 0.15, other: 0.10 };

/** Servings per bottle. A 750ml spirit bottle is about seventeen 45ml pours in
 *  theory and fifteen in a room with a queue, because a hurried hand is a
 *  generous one. Wine is five glasses, not six, for the same reason. */
const SERVINGS = { spirit: 15, wine: 5, beer: 1 };

/** Litres of soft drink per person per hour, everybody including children, and
 *  more of it when it is hot. Mixers are inside this number. */
const SOFT_PER_PERSON_HOUR: Record<Season, number> = { summer: 0.5, mild: 0.35, winter: 0.25 };

/** Kilos of ice per guest. Summer is not a small adjustment: ice goes into the
 *  drink, under the bottles, and into the tubs, and in August the third of
 *  those melts twice. */
const ICE_PER_GUEST: Record<Season, number> = { summer: 1.4, mild: 0.9, winter: 0.6 };

export type BarPlan = {
  drinkers: number;
  children: number;
  /** Total alcoholic servings the crowd is expected to get through. */
  servings: number;
  bottles: {
    vodka: number; whiskey: number; gin: number; other: number;
    wine: number; beer: number;
    /* Only his rule produces these; the serving model leaves them at zero. */
    campari: number; tequila: number; rum: number;
  };
  /** Total litres of alcohol, which is the number his sheet works in. */
  litres: number;
  softLitres: number;
  iceKg: number;
  /** Whole limes and lemons, which is the thing every bar runs out of. */
  citrus: number;
  cups: number;
};

const up = (n: number) => Math.max(0, Math.ceil(n));

export function planBar(crowd: Crowd, party: Party): BarPlan {
  const guests = Math.max(0, Math.round(crowd.guests));
  const children = Math.round(guests * clamp01(crowd.childrenPct / 100));
  const adults = Math.max(0, guests - children);
  const drinkers = Math.round(adults * clamp01(crowd.drinkersPct / 100));

  const hours = Math.max(0, party.hours);

  if (party.style === 'barak') return byLitres(guests, children, drinkers, hours, party.season);
  /* The first hour is charged at the higher rate and only once, which is why
     this is not hours × a single number. */
  const perDrinker = hours <= 0 ? 0
    : FIRST_HOUR_DRINKS + Math.max(0, hours - 1) * LATER_HOUR_DRINKS;

  const servings = Math.round(drinkers * perDrinker);
  const mix = MIX[party.style];

  const spiritServings = servings * mix.spirits;
  const wineServings = servings * mix.wine;
  const beerServings = servings * mix.beer;

  const spiritBottles = (share: number) => up((spiritServings * share) / SERVINGS.spirit);

  return {
    drinkers,
    children,
    servings,
    bottles: {
      vodka:   spiritBottles(SPIRIT_SPLIT.vodka),
      whiskey: spiritBottles(SPIRIT_SPLIT.whiskey),
      gin:     spiritBottles(SPIRIT_SPLIT.gin),
      other:   spiritBottles(SPIRIT_SPLIT.other),
      wine:    up(wineServings / SERVINGS.wine),
      beer:    up(beerServings / SERVINGS.beer),
      campari: 0, tequila: 0, rum: 0,
    },
    litres: Math.round(
      ((spiritServings * 0.045) + (wineServings * 0.15) + (beerServings * 0.33)) * 10
    ) / 10,
    softLitres: up(guests * hours * SOFT_PER_PERSON_HOUR[party.season]),
    iceKg: up(guests * ICE_PER_GUEST[party.season]),
    /* One fruit per fifteen drinkers, floor of two. It is the cheapest thing
       on the list and the most annoying to be without. */
    citrus: Math.max(2, up(drinkers / 15)),
    /* Nobody keeps the same cup all night. Two and a half each is what a bar
       actually goes through. */
    cups: up(guests * 2.5),
  };
}

/** His rule: total litres from headcount, then split by category. The crowd
 *  numbers still come back so the screen can show who was counted, but they do
 *  not change the answer, and the screen says so. */
function byLitres(
  guests: number, children: number, drinkers: number, hours: number, season: Season
): BarPlan {
  /* Adults only. His sheet is written for a wedding, where a headcount means
     the people at the tables, and children were never in the litres. */
  const adults = Math.max(0, guests - children);
  const litres = adults * LITRES_PER_PERSON;
  const spiritBottles = (share: number) => up((litres * share) / BOTTLE_LITRES.spirit);

  return {
    drinkers,
    children,
    /* A serving is 45ml of spirit or a third of a litre of beer. Mixed, the
       honest single number is litres, so the serving count here is derived
       for display rather than driving anything. */
    servings: Math.round((litres * 1000) / 90),
    bottles: {
      vodka:   spiritBottles(BARAK_SPLIT.vodka),
      whiskey: spiritBottles(BARAK_SPLIT.whiskey),
      gin:     0,
      other:   0,
      campari: spiritBottles(BARAK_SPLIT.campari),
      tequila: spiritBottles(BARAK_SPLIT.tequila),
      rum:     spiritBottles(BARAK_SPLIT.rum),
      wine:    up((litres * BARAK_SPLIT.wine) / BOTTLE_LITRES.wine),
      beer:    up((litres * BARAK_SPLIT.beer) / BOTTLE_LITRES.beer),
    },
    litres: Math.round(litres * 10) / 10,
    softLitres: up(guests * Math.max(1, hours) * SOFT_PER_PERSON_HOUR[season]),
    iceKg: up(guests * ICE_PER_GUEST[season]),
    citrus: Math.max(2, up(adults / 15)),
    cups: up(guests * 2.5),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** A shopping list with a price against it. Prices are per bottle or per unit
 *  and belong to whoever is buying, so they are an input rather than a
 *  constant: a producer with a supplier pays a different number from somebody
 *  walking into a shop, and a table of prices baked in here would be wrong for
 *  both of them within a year. */
export type Prices = {
  vodka: number; whiskey: number; gin: number; other: number;
  campari: number; tequila: number; rum: number;
  wine: number; beer: number; soft: number; ice: number; citrus: number; cups: number;
};

export const DEFAULT_PRICES: Prices = {
  vodka: 70, whiskey: 110, gin: 90, other: 80,
  campari: 85, tequila: 120, rum: 90,
  wine: 45, beer: 8, soft: 7, ice: 12, citrus: 3, cups: 0.4,
};

export type LineItem = { key: keyof Prices; qty: number; unitPrice: number; total: number };

export function shoppingList(plan: BarPlan, prices: Prices): { lines: LineItem[]; total: number } {
  const qty: Record<keyof Prices, number> = {
    vodka: plan.bottles.vodka,
    whiskey: plan.bottles.whiskey,
    gin: plan.bottles.gin,
    other: plan.bottles.other,
    campari: plan.bottles.campari,
    tequila: plan.bottles.tequila,
    rum: plan.bottles.rum,
    wine: plan.bottles.wine,
    beer: plan.bottles.beer,
    soft: plan.softLitres,
    ice: plan.iceKg,
    citrus: plan.citrus,
    cups: plan.cups,
  };

  const lines = (Object.keys(qty) as (keyof Prices)[])
    .filter((k) => qty[k] > 0)
    .map((k) => {
      const unitPrice = Number.isFinite(prices[k]) ? Math.max(0, prices[k]) : 0;
      return { key: k, qty: qty[k], unitPrice, total: Math.round(qty[k] * unitPrice) };
    });

  return { lines, total: lines.reduce((sum, l) => sum + l.total, 0) };
}
