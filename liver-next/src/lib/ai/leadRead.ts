import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { optional } from '@/lib/env';
import type { LeadIntent } from '@/lib/leadScore';

/**
 * One reading of a free-text enquiry.
 *
 * A message from WhatsApp or Instagram is a paragraph, and a paragraph has a
 * date in it, a guest count, a budget and a question, none of them in a
 * field. One call to the fast model turns the paragraph into the fields the
 * card has, says what the person is asking for in a word the score
 * understands, and drafts the first line of an answer in the producer's
 * voice. It does not decide anything: the score is computed from what it
 * returns, by rules in code, and the draft is a draft until somebody presses
 * send.
 *
 * Every path out returns a reading or null, and null means the card stands
 * as it arrived. A reading that invents a number is worse than no reading,
 * so the prompt says so twice and the parser drops anything that does not
 * look like what was asked for.
 */

export type LeadReading = {
  full_name: string | null;
  partner_name: string | null;
  event_date: string | null;
  date_flexible: boolean | null;
  guest_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  region: string | null;
  venue_booked: boolean | null;
  intent: LeadIntent;
  urgency: 'high' | 'medium' | 'low' | '';
  summary_he: string;
  suggested_reply_he: string;
};

export type LeadReadInput = {
  message: string;
  known: {
    full_name?: string; phone?: string; email?: string;
    event_date?: string | null; guest_count?: number | null; location?: string;
    source?: string; kind?: string;
  };
  /** Whose voice the reply is drafted in. */
  producer: { name: string; brand: string };
};

const INTENTS = new Set(['full_production', 'accompaniment', 'day_of', 'course', 'game', 'question', 'spam']);
const URGENCIES = new Set(['high', 'medium', 'low']);

const SYSTEM = `אתה קורא פניות שמגיעות למפיק חתונות ואירועים בישראל, ומחזיר JSON בלבד.
הפנייה היא טקסט חופשי: הודעת וואטסאפ, הודעה באינסטגרם או מייל. המשימה: לחלץ ממנה את מה שכתוב בה, ורק את מה שכתוב בה.

כללים שאסור להפר:
- אל תמציא מספרים. אם אין תאריך, אורחים או תקציב בטקסט, החזר null.
- תאריך מוחזר כ-YYYY-MM-DD. "יוני 2027" הוא 2027-06-15 עם date_flexible=true. "הקיץ הבא" הוא null.
- תקציב בש"ח. "120-160 אלף" הוא budget_min 120000 ו-budget_max 160000. "בערך 150" הוא 150000 בשניהם.
- intent הוא אחד מ: full_production (הפקה מלאה של החתונה), accompaniment (ליווי ותכנון בלי ניהול הערב), day_of (ניהול הערב בלבד), course (קורס או הרצאה), game (משחק הקלפים "לפני שאני אומרת כן"), question (שאלה כללית), spam (פרסומת, הודעה לא קשורה, בוט).
- urgency: high אם התאריך בפחות מארבעה חודשים או שכתוב "דחוף"; low אם אין תאריך; אחרת medium.
- summary_he: משפט אחד בעברית, עד 20 מילים, מה הפנייה.
- suggested_reply_he: תשובה קצרה בעברית, 2 עד 4 משפטים, בגוף ראשון, חמה וישירה, בלי אמוג'י, בלי הבטחת מחיר. מסיימת בשאלה אחת או בהצעה לשיחה. חתומה בשם המפיק.

החזר אובייקט JSON אחד עם המפתחות: full_name, partner_name, event_date, date_flexible, guest_count, budget_min, budget_max, region, venue_booked, intent, urgency, summary_he, suggested_reply_he. בלי טקסט לפני או אחרי.`;

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}
function asInt(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}
function asDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(t) ? null : `${m[1]}-${m[2]}-${m[3]}`;
}

/** The model's text, with any fence around it removed, parsed or null. */
export function parseReading(text: string): LeadReading | null {
  const body = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;

  const intent = typeof raw.intent === 'string' && INTENTS.has(raw.intent) ? (raw.intent as LeadIntent) : '';
  const urgency = typeof raw.urgency === 'string' && URGENCIES.has(raw.urgency) ? (raw.urgency as 'high' | 'medium' | 'low') : '';
  return {
    full_name: asString(raw.full_name, 120),
    partner_name: asString(raw.partner_name, 120),
    event_date: asDate(raw.event_date),
    date_flexible: asBool(raw.date_flexible),
    guest_count: asInt(raw.guest_count, 1, 1500),
    budget_min: asInt(raw.budget_min, 0, 10_000_000),
    budget_max: asInt(raw.budget_max, 0, 10_000_000),
    region: asString(raw.region, 120),
    venue_booked: asBool(raw.venue_booked),
    intent,
    urgency,
    summary_he: asString(raw.summary_he, 600) ?? '',
    suggested_reply_he: asString(raw.suggested_reply_he, 2000) ?? '',
  };
}

/** Whether a message has enough in it to be worth a reading. Twelve
 *  characters is "חתונה ביוני"; under that there is nothing to read. */
export const worthReading = (message: string): boolean => message.trim().length >= 12;

export async function readLead(input: LeadReadInput): Promise<LeadReading | null> {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key || !worthReading(input.message)) return null;

  const known = Object.entries(input.known)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n');

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      /* The fast model: a reading is a paragraph in and twelve fields out,
         and it happens on every arrival. */
      model: optional('ANTHROPIC_MODEL_FAST', 'claude-haiku-5-5'),
      max_tokens: 700,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content:
          `המפיק: ${input.producer.name}${input.producer.brand ? ` (${input.producer.brand})` : ''}\n`
          + `היום: ${new Date().toISOString().slice(0, 10)}\n`
          + (known ? `מה כבר ידוע מהטופס:\n${known}\n` : '')
          + `\nהפנייה:\n"""\n${input.message.slice(0, 6000)}\n"""`,
      }],
    });
    if (res.stop_reason === 'refusal') return null;
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('\n');
    return parseReading(text);
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error('[leadRead] the model could not read', { status: e.status, message: e.message });
    } else {
      console.error('[leadRead] the model could not read', { message: e instanceof Error ? e.message : String(e) });
    }
    return null;
  }
}
