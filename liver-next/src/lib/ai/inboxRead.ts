import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { optional } from '@/lib/env';
import { ACTION_KINDS } from '@/lib/inbox/kinds';
import type { eventFacts } from '@/lib/inbox/context';

/**
 * One reading of one thing that arrived.
 *
 * A supplier's quote, a couple's message, a calendar entry, a page somebody
 * photographed. The model says what it is in a word, in a sentence, and as
 * a list of proposals in the vocabulary of `kinds.ts`, each with a payload
 * the validator will check again before anything is written. It also says
 * when it cannot tell whose this is, and why, and that is a result rather
 * than a guess: a quote filed on the wrong wedding is a worse outcome than
 * a quote waiting in the sorting box.
 *
 * The prompt carries the event's own lines so a second quote from the same
 * caterer is an update and not a second line, and the producer's voice from
 * prompts/barak-voice.md so a draft reads like him.
 */

export type InboxReading = {
  summary_he: string;
  category: 'vendor_quote' | 'vendor_invoice' | 'couple_message' | 'meeting' | 'contract' | 'payment' | 'spam' | 'other';
  actions: { kind: string; confidence: number; title_he: string; payload: Record<string, unknown> }[];
  needs_human: boolean;
  needs_human_reason: string;
  /** When the sender was not known: which of the candidates this is about,
   *  or null. */
  client_id: string | null;
};

const CATEGORIES = new Set(['vendor_quote', 'vendor_invoice', 'couple_message', 'meeting', 'contract', 'payment', 'spam', 'other']);

let voiceCache: string | null = null;
export function producerVoice(): string {
  if (voiceCache !== null) return voiceCache;
  try { voiceCache = readFileSync(join(process.cwd(), 'prompts', 'barak-voice.md'), 'utf8'); }
  catch { voiceCache = ''; }
  return voiceCache;
}

const SYSTEM = `אתה קורא דברים שמגיעים למפיק חתונות בישראל: מיילים, הודעות וואטסאפ, קבצים שהועלו, רשומות יומן. אתה מחזיר JSON בלבד.

לכל פריט אתה מחזיר:
- summary_he: משפט אחד בעברית, עד 25 מילים, מה זה. עם שם השולח, שם הזוג אם ידוע, סכום אם יש, תאריך תוקף אם יש.
- category: אחד מ vendor_quote, vendor_invoice, couple_message, meeting, contract, payment, spam, other.
- actions: רשימת פעולות מוצעות. כל פעולה: kind (אחד מהסוגים למטה), confidence (0 עד 1), title_he (משפט קצר, למשל "הוסף לתקציב: צילום – דני כהן – 12,000 ש"ח"), payload (השדות המדויקים).
- needs_human: true אם יש משהו שמפיק חייב לקרוא בעצמו (סכסוך, ביטול, שאלה שדורשת החלטה, תאריך שזז).
- needs_human_reason: למה, במשפט, או null.
- client_id: אם השולח לא זוהה ואתה מזהה מהטקסט לאיזה אירוע מהרשימה זה שייך, ה-id שלו. אחרת null. אל תנחש: רק כשיש שם של הזוג, תאריך או אולם שמופיעים בטקסט.

סוגי פעולות ושדות ה-payload שלהם:
- budget_add_item: { category, vendor_name, amount_quoted, notes }. רק אם יש סכום בטקסט. אם יש כבר שורת תקציב לאותה קטגוריה או אותו ספק ברשימה שקיבלת, הצע budget_update_item במקום.
- budget_update_item: { budget_item_id, agreed או estimate, vendor_name, notes }.
- budget_mark_paid: { payment_id, paid_on } לתשלום של הזוג למפיק, או { budget_item_id, amount, paid_on, reference } לסכום ששולם לספק על שורת תקציב. רק אם כתוב במפורש ששולם.
- vendor_create: { name, category, contact_name, phone, email, notes }. רק לספק שלא ברשימה.
- vendor_update: { vendor_id, phone, email, contact_name, notes }.
- task_create: { title, due_date, owner }. owner הוא producer או client.
- task_complete: { task_id }.
- timeline_update: { title, at_time, note }. שעה בפורמט HH:MM.
- couple_field_update: { field, value }. field אחד מ guest_estimate, event_date, venue, contact_phone, contact_email.
- meeting_summary: { title, summary, held_on }. לסיכום פגישה.
- reply_draft: { channel, text }. טיוטת תשובה בקול של המפיק, לפי ההנחיות והדוגמאות שתקבל.

כללים:
- אל תמציא מספרים. אם אין סכום, אין פעולת תקציב.
- אם מחיר כולל או לא כולל מע"מ, ציין את זה ב-notes.
- מעט פעולות טובות עדיפות על הרבה. אם אין מה לעשות, actions ריק.
- החזר אובייקט JSON אחד. בלי טקסט לפני או אחרי.`;

type Facts = Awaited<ReturnType<typeof eventFacts>>;

export type InboxReadInput = {
  text: string;
  subject?: string;
  fromName?: string;
  fromIdentity?: string;
  channel: string;
  facts: Facts | null;
  candidates: { id: string; name: string; date: string | null; venue: string }[];
  /** Base64 documents to read alongside the text: PDFs and images. */
  documents?: { mime: string; base64: string; name: string }[];
  producerName: string;
};

export type ReadOutcome = {
  reading: InboxReading | null;
  usage: { model: string; input: number; output: number; ms: number; error?: string };
};

export function parseInboxReading(text: string): InboxReading | null {
  const body = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const s = body.indexOf('{');
  const e = body.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(body.slice(s, e + 1)) as Record<string, unknown>; } catch { return null; }
  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  return {
    summary_he: typeof raw.summary_he === 'string' ? raw.summary_he.trim().slice(0, 1000) : '',
    category: typeof raw.category === 'string' && CATEGORIES.has(raw.category) ? (raw.category as InboxReading['category']) : 'other',
    actions: actions
      .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
      .filter((a) => typeof a.kind === 'string' && (ACTION_KINDS as readonly string[]).includes(a.kind))
      .map((a) => ({
        kind: String(a.kind),
        confidence: Math.max(0, Math.min(1, Number(a.confidence) || 0)),
        title_he: typeof a.title_he === 'string' ? a.title_he.trim().slice(0, 300) : '',
        payload: (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>,
      }))
      .filter((a) => a.title_he)
      .slice(0, 8),
    needs_human: raw.needs_human === true,
    needs_human_reason: typeof raw.needs_human_reason === 'string' ? raw.needs_human_reason.slice(0, 300) : '',
    client_id: typeof raw.client_id === 'string' && /^[0-9a-f-]{36}$/i.test(raw.client_id) ? raw.client_id : null,
  };
}

const factsText = (f: Facts): string => [
  `האירוע: ${f.name}${f.date ? ` · ${f.date}` : ''}${f.venue ? ` · ${f.venue}` : ''}${f.guests ? ` · ${f.guests} אורחים` : ''}`,
  f.budget.length ? `שורות תקציב קיימות (id · קטגוריה · שם · הערכה · סוכם · ספק):\n${f.budget.map((b) => `${b.id} · ${b.category} · ${b.label} · ${b.estimate} · ${b.agreed ?? '-'} · ${b.vendor}`).join('\n')}` : 'אין שורות תקציב עדיין.',
  f.vendors.length ? `ספקים על האירוע (id · שם · קטגוריה · מצב):\n${f.vendors.map((v) => `${v.id} · ${v.name} · ${v.category} · ${v.status}`).join('\n')}` : 'אין ספקים על האירוע עדיין.',
  f.tasks.length ? `משימות פתוחות (id · כותרת · תאריך):\n${f.tasks.map((t) => `${t.id} · ${t.title} · ${t.due_on ?? '-'}`).join('\n')}` : '',
  f.payments.length ? `תשלומים (id · מה · סכום · תאריך · שולם):\n${f.payments.map((p) => `${p.id} · ${p.title} · ${p.amount} · ${p.due_on ?? '-'} · ${p.paid ? 'כן' : 'לא'}`).join('\n')}` : '',
].filter(Boolean).join('\n\n');

export async function readInbox(input: InboxReadInput): Promise<ReadOutcome> {
  const key = optional('ANTHROPIC_API_KEY');
  const heavy = Boolean(input.documents?.length) || input.text.length > 3000;
  const model = heavy ? optional('ANTHROPIC_MODEL', 'claude-opus-5') : optional('ANTHROPIC_MODEL_FAST', 'claude-haiku-5-5');
  const usage = { model, input: 0, output: 0, ms: 0 };
  if (!key) return { reading: null, usage: { ...usage, error: 'no key' } };

  const context = [
    `המפיק: ${input.producerName}`,
    `היום: ${new Date().toISOString().slice(0, 10)}`,
    `ערוץ: ${input.channel}`,
    input.fromName || input.fromIdentity ? `שולח: ${input.fromName ?? ''} ${input.fromIdentity ?? ''}`.trim() : '',
    input.subject ? `נושא: ${input.subject}` : '',
    input.facts ? factsText(input.facts) : `השולח לא זוהה. האירועים הפתוחים (id · שם · תאריך · מקום):\n${input.candidates.map((c) => `${c.id} · ${c.name} · ${c.date ?? '-'} · ${c.venue}`).join('\n') || 'אין'}`,
    producerVoice() ? `הקול של המפיק לטיוטות:\n${producerVoice()}` : '',
  ].filter(Boolean).join('\n\n');

  const content: Anthropic.MessageCreateParams['messages'][number]['content'] = [
    { type: 'text', text: `${context}\n\nהפריט:\n"""\n${input.text.slice(0, 12000)}\n"""` },
  ];
  for (const d of input.documents ?? []) {
    if (d.mime === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.base64 }, title: d.name } as never);
    } else if (/^image\/(png|jpeg|webp|gif)$/.test(d.mime)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: d.mime as 'image/png', data: d.base64 } });
    }
  }

  const started = Date.now();
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({ model, max_tokens: 1800, system: SYSTEM, messages: [{ role: 'user', content }] });
    usage.ms = Date.now() - started;
    usage.input = res.usage?.input_tokens ?? 0;
    usage.output = res.usage?.output_tokens ?? 0;
    if (res.stop_reason === 'refusal') return { reading: null, usage: { ...usage, error: 'refusal' } };
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const reading = parseInboxReading(text);
    return { reading, usage: reading ? usage : { ...usage, error: 'unparseable' } };
  } catch (e) {
    usage.ms = Date.now() - started;
    const msg = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e instanceof Error ? e.message : String(e);
    console.error('[inboxRead] the model could not read', { message: msg });
    return { reading: null, usage: { ...usage, error: msg.slice(0, 200) } };
  }
}
