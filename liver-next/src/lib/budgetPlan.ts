/**
 * The budget as a plan, a tracker and a weekly sentence.
 *
 * Three questions, one module, so the screen the couple reads, the screen
 * the producer reads and the Sunday email all say the same numbers:
 *
 *   allocate   how a total splits into areas, bent by what the couple would
 *              rather overspend on and what they would cut first;
 *   track      each area's planned figure against what is actually booked,
 *              with the one that has drifted past ten percent named and a
 *              trade-off offered;
 *   weekly     what changed in the last seven days and the three lines a
 *              Sunday morning wants: where we are, what to watch, what is
 *              due next.
 *
 * Pure, client-safe, tested. The Israeli split rather than the American: a
 * hall here is quoted per plate with the food in it, so "venue" and
 * "catering" are one line, and the rabbi is not a line at all.
 */

export const PLAN_CATEGORIES = [
  'venue', 'bar', 'photo', 'music', 'design', 'look', 'invites', 'transport', 'other', 'contingency',
] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

/** The baseline, in percent, summing to 100. */
export const BASE_SPLITS: Record<PlanCategory, number> = {
  venue: 52, bar: 5, photo: 12, music: 5, design: 8, look: 5, invites: 2, transport: 2, other: 3, contingency: 6,
};

const CONTINGENCY_FLOOR = 5;
const MUST_LIFT = 1.25;
const NICE_CUT = 0.6;
/** Past this share of the planned figure, a category is named. */
export const OVER_BY = 1.1;

export type PlanLine = {
  key: PlanCategory;
  base: number;
  pct: number;
  amount: number;
  /** Why it moved, as a reason key the screen turns into a sentence. */
  moved: 'must' | 'nice' | 'shift' | null;
};

export type BudgetPlan = {
  total: number;
  guests: number | null;
  must: PlanCategory[];
  nice: PlanCategory[];
  splits: Record<PlanCategory, number>;
};

export type Allocation = {
  lines: PlanLine[];
  /** The hall's share per guest, the one number a couple can sanity-check
   *  against a quote. Null without a guest count. */
  perHead: number | null;
};

/* Whole percentages that still sum to exactly 100: largest remainder. */
function wholePercents(raw: Record<PlanCategory, number>): Record<PlanCategory, number> {
  const keys = PLAN_CATEGORIES;
  const floors = keys.map((k) => Math.floor(raw[k]));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = keys
    .map((k, i) => ({ i, frac: raw[k] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  /* Round and round until it adds up, so a split far from whole numbers
     cannot leave a percent on the floor. */
  while (left > 0) {
    for (const o of order) {
      if (left <= 0) break;
      floors[o.i] += 1;
      left -= 1;
    }
  }
  return Object.fromEntries(keys.map((k, i) => [k, floors[i]])) as Record<PlanCategory, number>;
}

/** The split for one couple. */
export function allocate(input: {
  total: number; guests: number | null; must: readonly PlanCategory[]; nice: readonly PlanCategory[];
}): Allocation {
  const must = new Set(input.must.filter((k) => k !== 'contingency'));
  const nice = new Set(input.nice.filter((k) => k !== 'contingency' && !must.has(k)));

  const raw: Record<PlanCategory, number> = { ...BASE_SPLITS };
  for (const k of must) raw[k] = BASE_SPLITS[k] * MUST_LIFT;
  for (const k of nice) raw[k] = BASE_SPLITS[k] * NICE_CUT;
  raw.contingency = Math.max(CONTINGENCY_FLOOR, BASE_SPLITS.contingency);

  /* Whatever the lifts and cuts left over is absorbed by the areas nobody
     had an opinion about, in proportion. If every area was named, the lifted
     ones give back proportionally instead: the total is the total. */
  const pinned = [...must, ...nice, 'contingency' as PlanCategory];
  const free = PLAN_CATEGORIES.filter((k) => !pinned.includes(k));
  const pinnedSum = pinned.reduce((a, k) => a + raw[k], 0);
  const freeBase = free.reduce((a, k) => a + raw[k], 0);
  const room = 100 - pinnedSum;
  const moved: Partial<Record<PlanCategory, PlanLine['moved']>> = {};
  for (const k of must) moved[k] = 'must';
  for (const k of nice) moved[k] = 'nice';

  if (free.length > 0 && room > 0) {
    for (const k of free) {
      const next = raw[k] * (room / freeBase);
      if (Math.round(next) !== BASE_SPLITS[k]) moved[k] = 'shift';
      raw[k] = next;
    }
  } else {
    /* Nothing left unnamed to give or take, so everything but the safety
       margin scales together: the lifts and cuts keep their proportions to
       each other, and the total is the total. */
    const rest = PLAN_CATEGORIES.filter((k) => k !== 'contingency');
    const restSum = rest.reduce((a, k) => a + raw[k], 0);
    const target = 100 - raw.contingency;
    for (const k of rest) raw[k] = restSum > 0 ? raw[k] * (target / restSum) : 0;
  }

  const pct = wholePercents(raw);
  const lines: PlanLine[] = PLAN_CATEGORIES.map((k) => ({
    key: k,
    base: BASE_SPLITS[k],
    pct: pct[k],
    amount: Math.round((input.total * pct[k]) / 100 / 100) * 100,
    moved: pct[k] === BASE_SPLITS[k] ? null : (moved[k] ?? 'shift'),
  }));

  const venue = lines.find((l) => l.key === 'venue')!;
  const perHead = input.guests && input.guests > 0 ? Math.round(venue.amount / input.guests) : null;
  return { lines, perHead };
}

/* ── which area a budget line belongs to ──────────────────────────────────
   The category column has held three vocabularies over time: the template's
   keys, the production categories' Hebrew labels, and nothing at all when a
   line was typed by hand. So the key is read first, then the label's own
   words, and a line that says nothing recognisable is "other". */
const KEYS: Record<string, PlanCategory> = {
  venue: 'venue', catering: 'venue', hall: 'venue',
  bar: 'bar',
  photo: 'photo', photography: 'photo', video: 'photo', magnets: 'photo', photobooth: 'photo',
  music: 'music', dj: 'music', sound: 'music',
  design: 'design', decor: 'design', flowers: 'design', tech: 'design', lighting: 'design',
  look: 'look', attire: 'look', makeup: 'look', hair: 'look', rings: 'look',
  invites: 'invites', printing: 'invites', rsvp: 'invites',
  transport: 'transport',
  contingency: 'contingency',
};

const WORDS: [RegExp, PlanCategory][] = [
  [/בלת["״]?מ|ביטחון|בטחון|contingency/i, 'contingency'],
  [/אולם|מקום|קייטרינג|מנה|גן אירועים|venue|cater/i, 'venue'],
  [/אלכוהול|\bבר\b|מזיגה|bar\b/i, 'bar'],
  [/צלם|צילום|וידאו|וידיאו|מגנט|photo|video/i, 'photo'],
  [/די.?ג|dj|להקה|נגן|מוזיק|הגברה|music|band/i, 'music'],
  [/עיצוב|פרח|תאורה|תפאור|חופה|design|flower|decor/i, 'design'],
  [/שמלה|חליפה|איפור|שיער|טבעת|dress|suit|makeup|hair|ring/i, 'look'],
  [/הזמנ|אישורי|דפוס|invit|print|rsvp/i, 'invites'],
  [/הסע|שאטל|רכב|transport|shuttle/i, 'transport'],
];

export function categoryOf(item: { category?: string | null; label?: string | null }): PlanCategory {
  const key = String(item.category ?? '').trim().toLowerCase();
  if (key && KEYS[key]) return KEYS[key];
  const text = `${item.category ?? ''} ${item.label ?? ''}`;
  for (const [re, cat] of WORDS) if (re.test(text)) return cat;
  return 'other';
}

/* ── the tracker ────────────────────────────────────────────────────────── */

export type TrackItem = {
  category?: string | null; label?: string | null;
  estimate: number | string; agreed: number | string | null;
};

export type TrackRow = {
  key: PlanCategory;
  planned: number;
  actual: number;
  remaining: number;
  pct: number;
  lines: number;
  /** Past the planned figure by more than the tolerance. */
  over: boolean;
};

export type TradeOff = { cut: PlanCategory; headroom: number } | null;

export type Tracking = {
  rows: TrackRow[];
  flagged: TrackRow[];
  /** For the worst flag: the nice-to-have with the most left to give. */
  tradeOff: TradeOff;
  planned: number;
  actual: number;
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function track(items: readonly TrackItem[], plan: BudgetPlan | null): Tracking {
  const actual: Record<PlanCategory, number> = Object.fromEntries(PLAN_CATEGORIES.map((k) => [k, 0])) as never;
  const count: Record<PlanCategory, number> = { ...actual };
  for (const it of items) {
    const k = categoryOf(it);
    actual[k] += num(it.agreed ?? it.estimate);
    count[k] += 1;
  }

  const rows: TrackRow[] = PLAN_CATEGORIES.map((k) => {
    const planned = plan ? Math.round((plan.total * (plan.splits[k] ?? 0)) / 100) : 0;
    const a = actual[k];
    return {
      key: k,
      planned,
      actual: a,
      remaining: planned - a,
      pct: planned > 0 ? Math.round((a / planned) * 100) : (a > 0 ? 100 : 0),
      lines: count[k],
      over: planned > 0 && a > planned * OVER_BY,
    };
  }).filter((r) => r.planned > 0 || r.actual > 0);

  const flagged = rows.filter((r) => r.over).sort((a, b) => (b.actual - b.planned) - (a.actual - a.planned));

  let tradeOff: TradeOff = null;
  if (flagged.length > 0 && plan) {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const candidates = plan.nice
      .map((k) => byKey.get(k))
      .filter((r): r is TrackRow => !!r && r.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    const pick = candidates[0] ?? byKey.get('contingency');
    if (pick && pick.remaining > 0) tradeOff = { cut: pick.key, headroom: pick.remaining };
  }

  return {
    rows,
    flagged,
    tradeOff,
    planned: rows.reduce((a, r) => a + r.planned, 0),
    actual: rows.reduce((a, r) => a + r.actual, 0),
  };
}

/* ── the Sunday sentence ────────────────────────────────────────────────── */

export type WeekItem = TrackItem & { created_at?: string | null; vendor?: string | null };
export type WeekPayment = {
  title: string; amount: number | string; paid: boolean; paid_on?: string | null; due_on?: string | null;
};

export type Weekly = {
  /** Lines booked and payments made in the last seven days. */
  added: { label: string; amount: number; category: PlanCategory }[];
  paid: { title: string; amount: number; on: string }[];
  /** Committed against the target. Null target means no second number. */
  overall: { committed: number; target: number | null; pct: number | null };
  /** The one area to watch: the worst flag, or else the fullest. */
  watch: TrackRow | null;
  /** The next payment due inside thirty days. */
  nextDue: { title: string; amount: number; on: string } | null;
  flagged: TrackRow[];
  tradeOff: TradeOff;
};

const dayOf = (iso: string | null | undefined): string => String(iso ?? '').slice(0, 10);

export function weekly(
  items: readonly WeekItem[],
  payments: readonly WeekPayment[],
  plan: BudgetPlan | null,
  target: number | null,
  today: string,
): Weekly {
  const since = shift(today, -7);
  const until = shift(today, 30);

  const added = items
    .filter((i) => dayOf(i.created_at) >= since && dayOf(i.created_at) <= today)
    .map((i) => ({ label: String(i.label ?? ''), amount: num(i.agreed ?? i.estimate), category: categoryOf(i) }));

  const paid = payments
    .filter((p) => p.paid && dayOf(p.paid_on) >= since && dayOf(p.paid_on) <= today)
    .map((p) => ({ title: p.title, amount: num(p.amount), on: dayOf(p.paid_on) }));

  const committed = items.reduce((a, i) => a + num(i.agreed ?? i.estimate), 0);
  const cap = target !== null && Number.isFinite(Number(target)) ? num(target) : (plan?.total ?? null);

  const t = track(items, plan);
  const watch = t.flagged[0]
    ?? [...t.rows].filter((r) => r.key !== 'contingency' && r.planned > 0).sort((a, b) => b.pct - a.pct)[0]
    ?? null;

  const nextDue = payments
    .filter((p) => !p.paid && dayOf(p.due_on) >= today && dayOf(p.due_on) <= until)
    .sort((a, b) => dayOf(a.due_on).localeCompare(dayOf(b.due_on)))
    .map((p) => ({ title: p.title, amount: num(p.amount), on: dayOf(p.due_on) }))[0] ?? null;

  return {
    added, paid,
    overall: { committed, target: cap, pct: cap && cap > 0 ? Math.round((committed / cap) * 100) : null },
    watch,
    nextDue,
    flagged: t.flagged,
    tradeOff: t.tradeOff,
  };
}

export function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The column, as the application reads it, whatever the database sent. */
export function readPlan(raw: unknown): BudgetPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const total = Number(o.total);
  if (!Number.isFinite(total) || total <= 0) return null;
  const pick = (v: unknown): PlanCategory[] =>
    Array.isArray(v) ? v.filter((k): k is PlanCategory => (PLAN_CATEGORIES as readonly string[]).includes(String(k))) : [];
  const splitsRaw = (o.splits && typeof o.splits === 'object' ? o.splits : {}) as Record<string, unknown>;
  const splits = Object.fromEntries(
    PLAN_CATEGORIES.map((k) => [k, Math.max(0, Math.round(Number(splitsRaw[k]) || 0))]),
  ) as Record<PlanCategory, number>;
  const guests = Number(o.guests);
  return {
    total: Math.round(total),
    guests: Number.isFinite(guests) && guests > 0 ? Math.round(guests) : null,
    must: pick(o.must),
    nice: pick(o.nice),
    splits,
  };
}
