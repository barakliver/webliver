/**
 * The vocabulary of a wedding somebody sat at.
 *
 * A couple attends four weddings in the year before their own, and every
 * one of them is research they never write down. The fast tags below are
 * what they would have said out loud in the car home, and each one carries
 * the area of their own evening it lands on, so a year of "the bar was
 * slow" adds up to a line about the bar rather than four separate notes.
 *
 * Pure, and imported by both the browser and the tests. The labels are
 * Hebrew here and English in app.en.ts; the keys are what the row holds.
 */

export const CRITIQUE_AREAS = ['catering', 'bar', 'design', 'timing', 'other'] as const;
export type CritiqueArea = (typeof CRITIQUE_AREAS)[number];

export type CritiqueTag = { key: string; area: CritiqueArea };

/** What worked. */
export const PRO_TAGS: readonly CritiqueTag[] = [
  { key: 'foodGood',     area: 'catering' },
  { key: 'servedHot',    area: 'catering' },
  { key: 'plentyFood',   area: 'catering' },
  { key: 'barFast',      area: 'bar' },
  { key: 'barGoodDrink', area: 'bar' },
  { key: 'soundRight',   area: 'design' },
  { key: 'lightWarm',    area: 'design' },
  { key: 'receptionEasy', area: 'design' },
  { key: 'seatingEnough', area: 'design' },
  { key: 'ranOnTime',    area: 'timing' },
  { key: 'ceremonyShort', area: 'timing' },
  { key: 'staffPresent', area: 'other' },
  { key: 'parkingEasy',  area: 'other' },
];

/** What to avoid. */
export const CON_TAGS: readonly CritiqueTag[] = [
  { key: 'barQueue',     area: 'bar' },
  { key: 'barRanOut',    area: 'bar' },
  { key: 'foodCold',     area: 'catering' },
  { key: 'foodLate',     area: 'catering' },
  { key: 'noVeganOption', area: 'catering' },
  { key: 'musicTooLoud', area: 'design' },
  { key: 'lightHarsh',   area: 'design' },
  { key: 'noSeating',    area: 'design' },
  { key: 'receptionCrowded', area: 'design' },
  { key: 'startedLate',  area: 'timing' },
  { key: 'longGaps',     area: 'timing' },
  { key: 'noOneInCharge', area: 'other' },
  { key: 'parkingHard',  area: 'other' },
];

export const EVENT_STYLES = ['garden', 'hall', 'fridayNoon', 'nature'] as const;
export type EventStyle = (typeof EVENT_STYLES)[number];

const PRO_KEYS = new Set(PRO_TAGS.map((t) => t.key));
const CON_KEYS = new Set(CON_TAGS.map((t) => t.key));

export const isProTag = (k: string) => PRO_KEYS.has(k);
export const isConTag = (k: string) => CON_KEYS.has(k);
export const isStyle = (k: string) => (EVENT_STYLES as readonly string[]).includes(k);

const areaOf = new Map<string, CritiqueArea>(
  [...PRO_TAGS, ...CON_TAGS].map((t) => [t.key, t.area]),
);
export const areaOfTag = (key: string): CritiqueArea => areaOf.get(key) ?? 'other';

export type CritiqueLog = {
  id: string;
  venue_name: string;
  event_date: string | null;
  style: string;
  pros: string[];
  cons: string[];
  pros_note: string;
  cons_note: string;
  takeaways: string;
  photos: string[];
};

/* ── which area a written line is about ────────────────────────────────────
   A wedding tagged for the bar and the catering teaches something about
   both, and its takeaway was being read under both, which put a sentence
   about the bar under the heading for timing. So a line is routed by what
   it says, the way the budget planner routes a line item, and only falls
   back to the areas the wedding's tags touched when it says nothing that
   names one.

   Hebrew cannot be matched by substring. `בהזמנה` contains `מנה`, which
   filed "write the real time on the invitation" under catering; `הזמנות`
   contains `מנות`. So a Hebrew stem is matched with the letter before it
   required to be a non-letter or one of the attached prefixes — ב ה ו כ ל
   מ ש — which is what a word boundary means in a language that writes its
   prepositions joined on. The English words beside them keep \b, which
   works there. */
const HEB_PREFIX = '(?<![\u0590-\u05FF])(?:[\u05D1\u05D4\u05D5\u05DB\u05DC\u05DE\u05E9]{0,2})';
const heb = (...stems: string[]) => stems.map((w) => `${HEB_PREFIX}${w}`).join('|');

const LINE_WORDS: [CritiqueArea, RegExp][] = [
  ['bar', new RegExp(`\\b(bar|bartender|drink|alcohol|cocktail|wine|whisk)|${heb('בר\\b', 'ברמנ', 'ברמן', 'אלכוהול', 'קוקטייל', 'יין', 'וויסקי', 'שתי[יה]ה')}`, 'i')],
  ['catering', new RegExp(`\\b(food|menu|catering|dessert|chef|course|plate)|${heb('אוכל', 'קייטרינג', 'תפריט', 'קינוח', 'מנות', 'מנה', 'ארוח[הת]', 'טעים', 'שף')}`, 'i')],
  ['design', new RegExp(`\\b(design|light|flower|sound|music|seating|table|decor)|${heb('עיצוב', 'תאורה', 'פרח', 'סאונד', 'מוזיק', 'שולחנ', 'שולחן', 'ישיבה', 'כיסא', 'אווירה', 'סטיילינג')}`, 'i')],
  ['timing', new RegExp(`\\b(time|schedule|late|ceremony|timing)|${heb('שעה', 'שעות', 'לוז', 'זמנים', 'זמן', 'איחור', 'התחיל', 'חופה', 'התארך', 'התעכב')}`, 'i')],
];

/** The area a takeaway line is about, or null when it names none. */
export function areaOfLine(line: string): CritiqueArea | null {
  for (const [area, words] of LINE_WORDS) if (words.test(line)) return area;
  return null;
}

export type AreaSummary = {
  area: CritiqueArea;
  /** Tag keys seen, most-mentioned first, with how many weddings said it. */
  pros: { key: string; n: number }[];
  cons: { key: string; n: number }[];
  /** The couple's own lines, from the logs that touched this area. */
  takeaways: { venue: string; line: string }[];
};

/** Only the keys the lists know. A tag that has been renamed out of the
 *  content is dropped rather than counted under a label nobody has. */
const known = (keys: string[] | null | undefined, ok: (k: string) => boolean): string[] =>
  (keys ?? []).filter((k) => typeof k === 'string' && ok(k));

/**
 * A year of weddings, added up by the area of their own evening it lands on.
 *
 * A takeaway is written once per wedding and read under every area that
 * wedding taught something about, because that is how it gets used: the
 * couple opens "bar" the week they book the bar, and wants the sentences
 * they wrote after the two weddings whose bars were memorable.
 *
 * An area with nothing in it is left out. An empty summary is not a screen
 * with five empty headings on it.
 */
export function summarise(logs: CritiqueLog[]): AreaSummary[] {
  const byArea = new Map<CritiqueArea, AreaSummary>();
  const seen = new Map<CritiqueArea, Set<string>>();
  const at = (area: CritiqueArea): AreaSummary => {
    let row = byArea.get(area);
    if (!row) { row = { area, pros: [], cons: [], takeaways: [] }; byArea.set(area, row); seen.set(area, new Set()); }
    return row;
  };
  const bump = (list: { key: string; n: number }[], key: string) => {
    const found = list.find((x) => x.key === key);
    if (found) found.n += 1; else list.push({ key, n: 1 });
  };

  for (const log of logs) {
    const touched = new Set<CritiqueArea>();
    for (const key of known(log.pros, isProTag)) {
      const area = areaOfTag(key);
      bump(at(area).pros, key);
      touched.add(area);
    }
    for (const key of known(log.cons, isConTag)) {
      const area = areaOfTag(key);
      bump(at(area).cons, key);
      touched.add(area);
    }
    const lines = log.takeaways.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    /* A wedding with a takeaway and no tag still has to land somewhere. */
    const fallback: CritiqueArea[] = touched.size > 0 ? [...touched] : ['other'];
    for (const line of lines) {
      const named = areaOfLine(line);
      for (const area of named ? [named] : fallback) {
        /* `at` before `seen`: a line that names an area nothing was tagged
           for reaches here having never created its row. */
        const row = at(area);
        const already = seen.get(area)!;
        const stamp = `${log.id}:${line}`;
        if (already.has(stamp)) continue;
        already.add(stamp);
        row.takeaways.push({ venue: log.venue_name, line });
      }
    }
  }

  const order = new Map(CRITIQUE_AREAS.map((a, i) => [a, i]));
  return [...byArea.values()]
    .map((row) => ({
      ...row,
      pros: [...row.pros].sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)),
      cons: [...row.cons].sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)),
    }))
    .sort((a, b) => (order.get(a.area) ?? 9) - (order.get(b.area) ?? 9));
}

/* ── the circle ───────────────────────────────────────────────────────────── */

export const CIRCLE_CATEGORIES = ['general', 'vendors', 'styling', 'food'] as const;
export type CircleCategory = (typeof CIRCLE_CATEGORIES)[number];
export const isCategory = (k: string) => (CIRCLE_CATEGORIES as readonly string[]).includes(k);

/** The emoji beside each category, kept out of the copy so the two
 *  languages cannot end up with different marks. */
export const CATEGORY_MARK: Record<CircleCategory, string> = {
  general: '💬', vendors: '🌿', styling: '👗', food: '🍷',
};
