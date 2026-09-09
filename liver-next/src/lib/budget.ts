/** The first version priced every line per invited guest, which is wrong in
 *  both directions: a photographer does not cost more because more people were
 *  invited, and catering is not paid on invitations at all, it is paid on who
 *  actually turns up. Lines are now typed by how they really scale.
 *
 *  These are market-average anchors for an Israeli wedding, not a quote. */

export type Tier = 'garden' | 'hall' | 'boutique' | 'field';
export type Day = 'weekday' | 'friday' | 'saturday';
export type Season = 'spring' | 'summer' | 'winter';
export type Style = 'classic' | 'modern' | 'rustic' | 'lux';
export type Bar = 'none' | 'venue' | 'external';

export type Scale = 'guest' | 'table' | 'fixed';

export const TIER_PLATE: Record<Tier, number> = { garden: 300, hall: 255, boutique: 365, field: 330 };
export const DAY_K:     Record<Day, number>    = { weekday: 0.88, friday: 1.04, saturday: 1.12 };
export const SEASON_K:  Record<Season, number> = { spring: 1.0, summer: 1.06, winter: 0.94 };
export const STYLE_K:   Record<Style, number>  = { classic: 1.0, modern: 1.1, rustic: 0.94, lux: 1.38 };
export const BAR_PER_GUEST: Record<Bar, number> = { none: 0, venue: 38, external: 82 };

export const SEATS_PER_TABLE = 12;

export type BudgetInput = {
  invited: number;
  /** share of invitations that turn into people in the room */
  attendance: number;
  tier: Tier;
  plate: number;
  day: Day;
  season: Season;
  style: Style;
  bar: Bar;
};

export type BudgetLine = { key: string; label: string; scale: Scale; amount: number };

export type BudgetResult = {
  invited: number;
  attending: number;
  tables: number;
  lines: BudgetLine[];
  total: number;
  low: number;
  high: number;
  perGuest: number;
  /** what ten more people actually add, which is the number couples ask about */
  marginalTen: number;
};

export function computeBudget(input: BudgetInput): BudgetResult {
  const invited = clamp(input.invited, 0, 1500);
  const attending = Math.round(invited * input.attendance);
  const tables = Math.ceil(attending / SEATS_PER_TABLE) || 0;

  const styleK = STYLE_K[input.style];
  const plate = clamp(input.plate, 0, 2000) * DAY_K[input.day] * SEASON_K[input.season];
  const barPerGuest = BAR_PER_GUEST[input.bar];

  /* Photography steps rather than sliding: past roughly 350 people a second
     shooter stops being optional, and that is a step, not a rate. */
  const photo = 12000 * styleK + (attending > 350 ? 2600 : 0);

  const lines: BudgetLine[] = ([
    { key: 'catering', label: 'מקום וקייטרינג',    scale: 'guest', amount: attending * plate },
    { key: 'bar',      label: 'בר ואלכוהול',        scale: 'guest', amount: attending * barPerGuest },
    { key: 'center',   label: 'עיצוב שולחנות',      scale: 'table', amount: tables * 320 * styleK },
    { key: 'photo',    label: 'צילום ווידאו',       scale: 'fixed', amount: photo },
    { key: 'music',    label: 'מוזיקה והגברה',      scale: 'fixed', amount: 8200 * styleK },
    { key: 'design',   label: 'חופה ועיצוב',        scale: 'fixed', amount: 4800 * styleK },
    { key: 'prod',     label: 'תכנון והפקה',        scale: 'fixed', amount: 14000 },
    { key: 'extra',    label: 'הזמנות, איפור ונלוות', scale: 'fixed', amount: 6500 },
  ] as BudgetLine[]).filter((l) => l.amount > 0);

  const total = lines.reduce((a, l) => a + l.amount, 0);

  /* Ten more people bring their own plate and bar, plus the share of a table
     that every twelfth guest tips over. */
  const marginalTen = 10 * (plate + barPerGuest) + (10 / SEATS_PER_TABLE) * 320 * styleK;

  return {
    invited,
    attending,
    tables,
    lines,
    total,
    low: total * 0.9,
    high: total * 1.12,
    perGuest: attending ? total / attending : 0,
    marginalTen,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');
export const ilsRounded = (n: number) => ils(Math.round(n / 500) * 500);
