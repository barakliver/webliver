import { ils } from './money.ts';

/**
 * The vendor scout, from the producer's own book.
 *
 * The version of this that searches Instagram and review sites cannot run
 * here: the server has no open internet and those sites do not answer
 * scrapers. What a producer actually has is better than a stranger's
 * reviews: their own directory, with the suppliers they have already stood
 * beside at midnight, and the record of how often each was booked. So the
 * scout ranks that, on the three things the brief names: style fit to the
 * couple's words, fit to their budget, and strength, which here is how
 * often this producer has hired them and how complete the card is.
 *
 * Pure and tested. The screen adds the couple's date and hall to the
 * outreach it drafts.
 */

export type ScoutVendor = {
  id: string;
  name: string;
  category: string;
  contact_name: string;
  phone: string;
  email: string;
  area: string;
  notes: string;
  agreed_price: number | null;
  /** How many of this producer's events have this supplier on them. */
  bookings: number;
};

export type ScoutInput = {
  category: string;
  /** The couple's style, in their words: "חם, טבעי, לא מבוים". */
  style: string;
  budgetLow: number | null;
  budgetHigh: number | null;
  area: string;
  /** Words that rule a supplier out when they appear on the card. */
  dealBreakers: string;
};

export type ScoutResult = {
  vendor: ScoutVendor;
  style: number;
  budget: number;
  strength: number;
  total: number;
  /** Which of the couple's words the card echoes. */
  matched: string[];
  areaMatch: boolean;
  /** Deal-breaker words found on the card. */
  flags: string[];
};

export const words = (s: string): string[] =>
  String(s ?? '')
    .toLowerCase()
    .split(/[\s,;/·]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length >= 2);

const clamp10 = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

export function styleScore(v: ScoutVendor, style: string): { score: number; matched: string[] } {
  const want = words(style);
  if (want.length === 0) return { score: 5, matched: [] };
  const card = `${v.name} ${v.notes} ${v.area}`.toLowerCase();
  const matched = want.filter((w) => card.includes(w));
  return { score: clamp10((matched.length / want.length) * 10), matched };
}

export function budgetScore(price: number | null, low: number | null, high: number | null): number {
  if (price === null || (low === null && high === null)) return 5;
  if ((low === null || price >= low) && (high === null || price <= high)) return 10;
  const edge = high !== null && price > high ? high : (low as number);
  const away = Math.abs(price - edge) / Math.max(edge, 1);
  return clamp10(10 - away * 20);
}

export function strengthScore(v: ScoutVendor): number {
  return clamp10(v.bookings * 3 + (v.notes.trim() ? 2 : 0) + (v.phone.trim() ? 1 : 0) + (v.email.trim() ? 1 : 0));
}

export function scout(vendors: readonly ScoutVendor[], input: ScoutInput, top = 5): ScoutResult[] {
  const breakers = words(input.dealBreakers);
  const wantArea = input.area.trim().toLowerCase();
  return vendors
    .filter((v) => !input.category || v.category === input.category)
    .map((v) => {
      const { score: style, matched } = styleScore(v, input.style);
      const budget = budgetScore(v.agreed_price, input.budgetLow, input.budgetHigh);
      const strength = strengthScore(v);
      const card = `${v.notes} ${v.name}`.toLowerCase();
      const flags = breakers.filter((b) => card.includes(b));
      const areaMatch = !!wantArea && v.area.toLowerCase().includes(wantArea);
      return { vendor: v, style, budget, strength, matched, flags, areaMatch, total: style + budget + strength + (areaMatch ? 1 : 0) };
    })
    .sort((a, b) => b.total - a.total || b.vendor.bookings - a.vendor.bookings || a.vendor.name.localeCompare(b.vendor.name))
    .slice(0, top);
}

/* ── the outreach ───────────────────────────────────────────────────────── */

export type OutreachInput = {
  vendorName: string;
  contactName: string;
  couple: string;
  date: string;
  venue: string;
  guests: number | null;
  budgetLow: number | null;
  budgetHigh: number | null;
  signAs: string;
  /** What the supplier is being asked for, in the producer's words. */
  category: string;
};


export function budgetLine(low: number | null, high: number | null): string {
  /* Plain text for a WhatsApp message, which is one of the places the string
     form of a sum is the right answer. */
  const lo = low === null ? '' : ils(low);
  const hi = high === null ? '' : ils(high);
  if (lo && hi) return `בין ${lo} ל-${hi}`;
  if (hi) return `עד ${hi}`;
  if (lo) return `מ-${lo}`;
  return '[להשלים]';
}

/** A message ready to paste into WhatsApp. Specific where the system knows
 *  the fact, and a bracket where only the producer does: the one detail
 *  from the supplier's own work that makes the message not a template. */
export function outreach(o: OutreachInput): string {
  const to = o.contactName.trim() || o.vendorName.trim() || '[שם]';
  const guests = o.guests ? `, בערך ${o.guests} אורחים` : '';
  const venue = o.venue.trim() ? ` ב${o.venue.trim()}` : '';
  return [
    `היי ${to},`,
    `אני ${o.signAs || '[שם]'}, מפיק/ה של החתונה של ${o.couple || '[שם הזוג]'} ב-${o.date || '[תאריך]'}${venue}${guests}.`,
    `[פרט אחד מהעבודה שלכם שראיתי, ולמה הוא מתאים לזוג הזה]`,
    `התקציב שלנו ל${o.category || 'תחום'}: ${budgetLine(o.budgetLow, o.budgetHigh)}.`,
    `שתי שאלות: התאריך פנוי אצלכם? ומה כולל המחיר בחבילה שמתאימה לאירוע בגודל הזה?`,
    `נשמח לשיחה של 20 דקות השבוע. מתי נוח לכם?`,
    o.signAs || '[שם]',
  ].join('\n');
}

/** The same message with the supplier left blank, for the other four. */
export function outreachGeneric(o: Omit<OutreachInput, 'vendorName' | 'contactName'>): string {
  return outreach({ ...o, vendorName: '[שם הספק]', contactName: '' });
}

/** The next Tuesday-to-Thursday window from a given day. Suppliers' inboxes
 *  drown on Sunday and Monday; a message on Tuesday morning gets read. */
export function bestSendWindow(today: string): { from: string; to: string; now: boolean } {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 Sunday
  const now = dow >= 2 && dow <= 4;
  const toTue = dow <= 2 ? 2 - dow : dow <= 4 ? 0 : 9 - dow;
  const from = new Date(d); from.setUTCDate(d.getUTCDate() + (now ? 0 : toTue));
  const tue = new Date(d); tue.setUTCDate(d.getUTCDate() + toTue - (now ? dow - 2 : 0));
  const to = new Date(tue); to.setUTCDate(tue.getUTCDate() + 2);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), now };
}
