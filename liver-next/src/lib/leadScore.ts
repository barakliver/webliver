/**
 * How much an enquiry is worth, as a number anybody can argue with.
 *
 * Computed here and never by the model: a score the model invents is a score
 * nobody can explain to the producer who asks why a couple with a venue and
 * a date sits under one with neither. Every rule below is one line, the
 * reason is written out beside the number, and the test next door holds each
 * rule to its sentence.
 *
 * The scale is the one in the brief. Date in the window the business sells
 * into, what they are asking for, a way to ring them, a budget worth the
 * year, and where they came from. Spam is zero and is handled before any of
 * it: a score of zero with a reason is how the pile knows not to ring.
 */

export type LeadIntent =
  | 'full_production' | 'accompaniment' | 'day_of' | 'course' | 'game' | 'question' | 'spam' | '';

export type Scorable = {
  event_date?: string | null;
  intent?: LeadIntent | string | null;
  phone?: string | null;
  email?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  source?: string | null;
};

export type Scored = { score: number; reason: string };

const DAY = 86_400_000;

/** Whole months between today and the date, floored; null when unknown. */
function monthsOut(date: string | null | undefined, today: string): number | null {
  if (!date) return null;
  const t = new Date(date + 'T00:00:00').getTime();
  const n = new Date(today + 'T00:00:00').getTime();
  if (Number.isNaN(t) || Number.isNaN(n)) return null;
  return Math.floor((t - n) / (30.4375 * DAY));
}

const INTENT_POINTS: Record<string, number> = {
  full_production: 30,
  accompaniment: 20,
  day_of: 10,
  course: 5,
  game: 5,
};

const INTENT_WORD: Record<string, string> = {
  full_production: 'הפקה מלאה',
  accompaniment: 'ליווי',
  day_of: 'ניהול הערב',
  course: 'קורס',
  game: 'משחק',
  question: 'שאלה',
};

/** The score, and the sentence that explains it. `today` is ISO yyyy-mm-dd in
 *  the events' zone, passed in so the function is pure and the test can set
 *  the calendar. */
export function scoreLead(lead: Scorable, today: string): Scored {
  const intent = String(lead.intent ?? '').trim();
  if (intent === 'spam') return { score: 0, reason: 'נראה כמו ספאם' };

  const parts: string[] = [];
  let score = 0;

  const months = monthsOut(lead.event_date, today);
  if (months === null) {
    score += 10; parts.push('בלי תאריך (10)');
  } else if (months < 0) {
    parts.push('התאריך עבר (0)');
  } else if (months < 3) {
    score += 10; parts.push('פחות משלושה חודשים (10)');
  } else if (months < 4) {
    score += 20; parts.push('שלושה עד ארבעה חודשים (20)');
  } else if (months <= 14) {
    score += 30; parts.push('ארבעה עד ארבעה עשר חודשים (30)');
  } else {
    score += 20; parts.push('יותר מארבעה עשר חודשים (20)');
  }

  const ip = INTENT_POINTS[intent];
  if (ip) {
    score += ip; parts.push(`${INTENT_WORD[intent]} (${ip})`);
  } else if (intent === 'question') {
    parts.push('שאלה בלבד (0)');
  }

  const phone = String(lead.phone ?? '').trim();
  const email = String(lead.email ?? '').trim();
  if (phone) {
    score += 15; parts.push('יש טלפון (15)');
  } else if (email) {
    score += 5; parts.push('אימייל בלבד (5)');
  }

  const budget = Math.max(Number(lead.budget_max ?? 0), Number(lead.budget_min ?? 0));
  if (Number.isFinite(budget) && budget > 100_000) {
    score += 15; parts.push('תקציב מעל 100 אלף (15)');
  }

  const source = String(lead.source ?? '').trim().toLowerCase();
  if (source === 'referral' || source === 'before_i_do') {
    score += 10; parts.push(source === 'referral' ? 'המלצה (10)' : 'מהמשחק (10)');
  }

  return { score: Math.min(100, score), reason: parts.join(' · ') };
}

/** The one threshold the alerting reads: at this and above a lead rings even
 *  in quiet hours. */
export const RING_ANYWAY = 80;
