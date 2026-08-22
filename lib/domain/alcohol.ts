/**
 * Smart bar & alcohol estimator — מחשבון אלכוהול ובר חכם
 *
 * Pure, dependency-free and deterministic, so it can be unit-tested and reused
 * on the server, in the client component, or by the existing single-file app.
 *
 * The base curve is the one the product already used (1 litre of alcohol per 9
 * drinking guests over a 6-hour event), extended here with an age distribution,
 * a party style, per-bottle sizing, ice, and a costed shopping list.
 */

export type Season = 'summer' | 'winter' | 'shoulder';
export type PartyStyle = 'seated' | 'mixed' | 'dancing';
export type VenueSupply = 'none' | 'partial' | 'bottles' | 'open';
export type DrinkKey = 'vodka' | 'whiskey' | 'gin' | 'arak' | 'tequila' | 'wine' | 'beer';

/** Percentages of the guest list per age band. They are normalized, so they need not sum to 100. */
export interface AgeDistribution {
  under25: number;
  age25to40: number;
  age40to60: number;
  over60: number;
}

export interface AlcoholInput {
  guests: number;
  ageDistribution: AgeDistribution;
  /** Share of guests who drink alcohol at all, 0–100. Defaults to 75. */
  drinkersPct?: number;
  /** Reception through end, in hours. Defaults to 6. */
  hours?: number;
  season?: Season;
  style?: PartyStyle;
  venueSupply?: VenueSupply;
  /** Only used when venueSupply is 'bottles'. */
  tables?: number;
  bottlesPerTable?: number;
  /** Optional price overrides, in ILS per bottle. */
  prices?: Partial<Record<DrinkKey, number>>;
}

export interface ShoppingLine {
  key: DrinkKey;
  labelHe: string;
  labelEn: string;
  liters: number;
  bottleSizeL: number;
  bottles: number;
  unitPrice: number;
  cost: number;
}

export interface AlcoholEstimate {
  /** Total alcohol the crowd is expected to drink. */
  totalLiters: number;
  /** Covered by the venue's own package. */
  suppliedLiters: number;
  /** What actually has to be bought. */
  purchaseLiters: number;
  softDrinkLiters: number;
  iceKg: number;
  drinkingGuests: number;
  lines: ShoppingLine[];
  totalCost: number;
  /** Multipliers applied, exposed so the UI can explain the number. */
  factors: { age: number; season: number; style: number; duration: number };
  notes: { he: string; en: string }[];
}

const BOTTLE_SIZE_L: Record<DrinkKey, number> = {
  vodka: 0.7,
  whiskey: 0.7,
  gin: 0.7,
  arak: 0.7,
  tequila: 0.7,
  wine: 0.75,
  beer: 0.33,
};

/** Indicative Israeli retail prices per bottle, in ILS. Override via `prices`. */
const DEFAULT_PRICE: Record<DrinkKey, number> = {
  vodka: 90,
  whiskey: 130,
  gin: 110,
  arak: 60,
  tequila: 140,
  wine: 45,
  beer: 8,
};

const LABELS: Record<DrinkKey, { he: string; en: string }> = {
  vodka: { he: 'וודקה', en: 'Vodka' },
  whiskey: { he: 'וויסקי', en: 'Whiskey' },
  gin: { he: "ג'ין", en: 'Gin' },
  arak: { he: 'ערק', en: 'Arak' },
  tequila: { he: 'טקילה', en: 'Tequila' },
  wine: { he: 'יין', en: 'Wine' },
  beer: { he: 'בירה', en: 'Beer' },
};

/** How hard each age band drinks, relative to the base curve. */
const AGE_FACTOR = { under25: 1.25, age25to40: 1.15, age40to60: 0.95, over60: 0.6 } as const;

/**
 * Drink mix per age band. Younger crowds skew to beer and vodka, older crowds
 * to whiskey and wine. Each column sums to 1.
 */
const AGE_MIX: Record<keyof AgeDistribution, Record<DrinkKey, number>> = {
  under25: { beer: 0.38, wine: 0.14, vodka: 0.22, whiskey: 0.05, arak: 0.07, tequila: 0.1, gin: 0.04 },
  age25to40: { beer: 0.32, wine: 0.24, vodka: 0.16, whiskey: 0.09, arak: 0.08, tequila: 0.05, gin: 0.06 },
  age40to60: { beer: 0.26, wine: 0.34, vodka: 0.1, whiskey: 0.16, arak: 0.08, tequila: 0.02, gin: 0.04 },
  over60: { beer: 0.18, wine: 0.44, vodka: 0.06, whiskey: 0.22, arak: 0.07, tequila: 0.0, gin: 0.03 },
};

const SEASON_FACTOR: Record<Season, number> = { summer: 1.2, winter: 0.95, shoulder: 1 };

/** A seated dinner drinks less than a dance-floor event of the same length. */
const STYLE_FACTOR: Record<PartyStyle, number> = { seated: 0.85, mixed: 1, dancing: 1.2 };

const DRINK_KEYS: DrinkKey[] = ['vodka', 'whiskey', 'gin', 'arak', 'tequila', 'wine', 'beer'];

const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Normalizes an age distribution to fractions summing to 1. Falls back to a typical Israeli wedding spread. */
export function normalizeAges(dist: AgeDistribution): Record<keyof AgeDistribution, number> {
  const raw = {
    under25: Math.max(0, dist.under25 || 0),
    age25to40: Math.max(0, dist.age25to40 || 0),
    age40to60: Math.max(0, dist.age40to60 || 0),
    over60: Math.max(0, dist.over60 || 0),
  };
  const total = raw.under25 + raw.age25to40 + raw.age40to60 + raw.over60;
  if (total <= 0) return { under25: 0.25, age25to40: 0.35, age40to60: 0.25, over60: 0.15 };
  return {
    under25: raw.under25 / total,
    age25to40: raw.age25to40 / total,
    age40to60: raw.age40to60 / total,
    over60: raw.over60 / total,
  };
}

export function estimateAlcohol(input: AlcoholInput): AlcoholEstimate {
  const guests = Math.max(0, Math.floor(input.guests || 0));
  const hours = clamp(input.hours ?? 6, 1, 16);
  const season = input.season ?? 'shoulder';
  const style = input.style ?? 'mixed';
  const venueSupply = input.venueSupply ?? 'none';
  const drinkersPct = clamp(input.drinkersPct ?? 75, 0, 100);

  const ages = normalizeAges(input.ageDistribution);
  const ageFactor =
    ages.under25 * AGE_FACTOR.under25 +
    ages.age25to40 * AGE_FACTOR.age25to40 +
    ages.age40to60 * AGE_FACTOR.age40to60 +
    ages.over60 * AGE_FACTOR.over60;

  const seasonFactor = SEASON_FACTOR[season];
  const styleFactor = STYLE_FACTOR[style];
  const durationFactor = hours / 6;

  const drinkingGuests = (guests * drinkersPct) / 100;
  // Base curve: 1L per 9 drinking guests across 6 hours.
  const totalLiters = (drinkingGuests / 9) * durationFactor * ageFactor * seasonFactor * styleFactor;

  // Blend the per-band mixes by the crowd's actual composition.
  const mix = DRINK_KEYS.reduce<Record<DrinkKey, number>>(
    (acc, key) => {
      acc[key] =
        ages.under25 * AGE_MIX.under25[key] +
        ages.age25to40 * AGE_MIX.age25to40[key] +
        ages.age40to60 * AGE_MIX.age40to60[key] +
        ages.over60 * AGE_MIX.over60[key];
      return acc;
    },
    { vodka: 0, whiskey: 0, gin: 0, arak: 0, tequila: 0, wine: 0, beer: 0 },
  );
  const mixTotal = DRINK_KEYS.reduce((s, k) => s + mix[k], 0) || 1;

  let suppliedLiters = 0;
  const notes: { he: string; en: string }[] = [];

  if (venueSupply === 'open') {
    suppliedLiters = totalLiters;
    notes.push({
      he: 'האולם מספק בר פתוח מלא — ודאו בחוזה מה בדיוק כלול ומה נחשב "פרימיום" בתוספת תשלום.',
      en: 'The venue runs a full open bar — confirm in the contract exactly what is included and what counts as premium.',
    });
  } else if (venueSupply === 'bottles') {
    const tables = Math.max(1, Math.floor(input.tables || Math.ceil(guests / 12)));
    const perTable = Math.max(0, input.bottlesPerTable ?? 2);
    suppliedLiters = tables * perTable * 0.75;
    notes.push({
      he: `${tables} שולחנות × ${perTable} בקבוקים ≈ ${round(suppliedLiters)} ליטר מהאולם.`,
      en: `${tables} tables × ${perTable} bottles ≈ ${round(suppliedLiters)}L from the venue.`,
    });
    notes.push({
      he: 'קבעו מראש שאין הוצאת בקבוק נוסף ללא אישור מפיק — זה הסעיף שמפוצץ תקציבים.',
      en: 'Agree upfront that no extra bottle leaves the bar without producer approval — this is the line that blows budgets.',
    });
  } else if (venueSupply === 'partial') {
    suppliedLiters = totalLiters * ((mix.beer + mix.wine) / mixTotal);
    notes.push({
      he: 'האולם מכסה יין ובירה — החריפים (וודקה/וויסקי/ערק) עליכם.',
      en: 'The venue covers wine and beer — the spirits are on you.',
    });
  }

  suppliedLiters = Math.min(suppliedLiters, totalLiters);
  const purchaseLiters = Math.max(0, totalLiters - suppliedLiters);

  const lines: ShoppingLine[] = DRINK_KEYS.map((key) => {
    const share = mix[key] / mixTotal;
    const liters = purchaseLiters * share;
    const bottleSizeL = BOTTLE_SIZE_L[key];
    const bottles = liters > 0 ? Math.ceil(liters / bottleSizeL) : 0;
    const unitPrice = input.prices?.[key] ?? DEFAULT_PRICE[key];
    return {
      key,
      labelHe: LABELS[key].he,
      labelEn: LABELS[key].en,
      liters: round(liters),
      bottleSizeL,
      bottles,
      unitPrice,
      cost: bottles * unitPrice,
    };
  }).filter((line) => line.bottles > 0);

  const softDrinkLiters = Math.round(guests * (season === 'summer' ? 1.1 : 0.7));
  // Ice is the most commonly forgotten line on the sheet.
  const iceKg = Math.ceil(guests * (season === 'summer' ? 1.5 : 0.8));
  const totalCost = lines.reduce((sum, line) => sum + line.cost, 0);

  notes.push({
    he: 'בסיס החישוב: ליטר לכל 9 אורחים שותים באירוע של 6 שעות, מתוקנן לפי גילאים, משך, עונה ואופי האירוע.',
    en: 'Base: 1L per 9 drinking guests over 6 hours, adjusted for age mix, duration, season and party style.',
  });
  if (season === 'summer') {
    notes.push({
      he: `קיץ: +20% ובעיקר בירה. קרח: ${iceKg} ק"ג (1.5 ק"ג לאורח).`,
      en: `Summer: +20%, mostly beer. Ice: ${iceKg}kg (1.5kg per guest).`,
    });
  }
  if (season === 'winter') {
    notes.push({
      he: 'חורף: צריכת בירה יורדת, וויסקי ויין אדום עולים. שקלו פינת משקה חם בקבלת פנים.',
      en: 'Winter: beer drops, whiskey and red wine rise. Consider a hot-drink station at the reception.',
    });
  }
  if (hours > 7) {
    notes.push({
      he: 'אירוע ארוך מ-7 שעות — תכננו מנה מלווה באפטר, אחרת קצב השתייה מטפס מהר מדי.',
      en: 'Over 7 hours — plan food alongside the after-party, otherwise the drinking pace escalates.',
    });
  }
  if (ages.under25 >= 0.4) {
    notes.push({
      he: 'קהל צעיר: הוסיפו 10% רזרבה בצד ואל תוציאו אותה ללא אישור. עדיף לסיים עם עודף מאשר לרוץ לחנות ב-01:00.',
      en: 'Young crowd: keep a 10% reserve aside and release it only on approval. Better to finish with surplus than to run to a shop at 1am.',
    });
  }
  notes.push({
    he: `מיקסרים ומשקאות קלים: כ-${softDrinkLiters} ליטר. יחס עבודה: 1:3 לוודקה, 1:2 לוויסקי.`,
    en: `Mixers and soft drinks: about ${softDrinkLiters}L. Working ratio: 1:3 for vodka, 1:2 for whiskey.`,
  });
  notes.push({
    he: 'כלל מקצועי: תמיד לסכם בחוזה מי אחראי לקרח, כוסות ולימונים — זה הפער הכי נפוץ בין מפיק לאולם.',
    en: 'Professional rule: always define in the contract who supplies ice, glassware and citrus — the most common gap between producer and venue.',
  });

  return {
    totalLiters: round(totalLiters),
    suppliedLiters: round(suppliedLiters),
    purchaseLiters: round(purchaseLiters),
    softDrinkLiters,
    iceKg,
    drinkingGuests: Math.round(drinkingGuests),
    lines,
    totalCost: Math.round(totalCost),
    factors: {
      age: round(ageFactor, 3),
      season: seasonFactor,
      style: styleFactor,
      duration: round(durationFactor, 3),
    },
    notes,
  };
}

export const ALCOHOL_DEFAULTS: AlcoholInput = {
  guests: 200,
  ageDistribution: { under25: 25, age25to40: 35, age40to60: 25, over60: 15 },
  drinkersPct: 75,
  hours: 6,
  season: 'summer',
  style: 'mixed',
  venueSupply: 'none',
};
