/* Relative, with the extension, the way siteCopy.ts imports its own content.
   The `@/` alias is a bundler convention and the test runner has no bundler,
   so a lib file that has to be testable without one reaches for the path. */
import { fieldsOf, meetingTemplate, type MeetingTemplate } from '../../content/meetings.ts';

/**
 * A meeting, turned into something a person can read six months later.
 *
 * Two ways out, and the plain one comes first on purpose. `writeSummary()`
 * builds a real summary out of the answers with no model, no key and no
 * network — headings, the fields that were filled in, and nothing invented.
 * That is what a producer gets on a server with nothing configured, and it is
 * genuinely useful rather than a placeholder.
 *
 * The model, when there is one, is asked to do the one thing the deterministic
 * version cannot: write the prose paragraph at the top that says what was
 * actually decided. It is given the answers and nothing else — no guest list,
 * no budget, no other event — and if it fails, the plain summary stands.
 *
 * Kept out of the route so it can be tested without any of that.
 */

const line = (label: string, value: string) => `${label}: ${value}`;

/** An answer as a person would read it. `true`/`false` are the only values
 *  that would otherwise reach the page in English. */
export function readAnswer(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'boolean') return raw ? 'כן' : 'לא';
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
  return String(raw).trim();
}

/**
 * The summary that needs nothing.
 *
 * Sections in the template's own order, and a section with nothing in it is
 * left out entirely rather than printed with a row of dashes — a summary whose
 * headings outnumber its content reads as a form that was not filled in, which
 * is exactly what it is, and saying it once at the end is kinder than saying
 * it four times in the middle.
 */
export function writeSummary(template: MeetingTemplate, answers: Record<string, unknown>): string {
  const out: string[] = [];

  for (const section of template.sections) {
    const rows = section.fields
      .map((f) => ({ f, v: readAnswer(answers[f.id]) }))
      .filter((r) => r.v !== '');
    if (rows.length === 0) continue;

    out.push(section.title);
    out.push(...rows.map((r) => line(r.f.label, r.v)));
    out.push('');
  }

  if (out.length === 0) return '';
  return out.join('\n').trimEnd();
}

/** How much of the form was answered. The screen says this rather than
 *  implying a half filled meeting is a finished one. */
export function completeness(template: MeetingTemplate, answers: Record<string, unknown>): {
  filled: number; total: number;
} {
  const fields = fieldsOf(template);
  const filled = fields.filter((f) => readAnswer(answers[f.id]) !== '').length;
  return { filled, total: fields.length };
}

/** Only keys the template actually defines survive. A questionnaire posted
 *  from a browser is attacker controlled, and a stored answer under a key
 *  nothing renders is a row that grows forever and is read by nobody. */
export function cleanAnswers(kind: string, raw: unknown): Record<string, string | number | boolean> {
  const t = meetingTemplate(kind);
  if (!t || typeof raw !== 'object' || raw === null) return {};

  const known = new Map(fieldsOf(t).map((f) => [f.id, f]));
  const out: Record<string, string | number | boolean> = {};

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const field = known.get(k);
    if (!field) continue;

    if (field.kind === 'yesno') {
      if (typeof v === 'boolean') out[k] = v;
      else if (v === 'true' || v === 'false') out[k] = v === 'true';
      continue;
    }
    if (field.kind === 'number') {
      const n = Number(v);
      /* A number nobody could have meant is dropped rather than stored: a
         guest count of nine million is a stuck key, not an answer. */
      if (Number.isFinite(n) && n >= 0 && n < 1_000_000) out[k] = n;
      continue;
    }
    if (field.kind === 'choice') {
      const s = String(v ?? '');
      if ((field.options ?? []).includes(s)) out[k] = s;
      continue;
    }

    const s = String(v ?? '').trim();
    if (s !== '') out[k] = s.slice(0, field.kind === 'long' ? 4000 : 400);
  }

  return out;
}

/** What the model is asked. Narrow on purpose: it summarises, it does not
 *  advise, and it is told in as many words not to invent a fact that is not
 *  in front of it. A summary that quietly adds a supplier nobody booked is
 *  worse than no summary at all. */
export function summaryPrompt(template: MeetingTemplate, answers: Record<string, unknown>): string {
  return [
    `סיכום פגישה מסוג "${template.title}" בהפקת אירוע.`,
    '',
    'להלן מה שנרשם בפגישה. כתוב פסקה אחת עד שתיים בעברית שמסכמת מה סוכם,',
    'בגוף שלישי, בלי כותרות ובלי רשימות.',
    '',
    'חוקים:',
    'אל תמציא שום פרט שאינו מופיע למטה.',
    'אם משהו לא נענה, אל תזכיר אותו ואל תכתוב שהוא חסר.',
    'אל תיתן המלצות ואל תוסיף דעה.',
    'אם אין מספיק מידע לפסקה, החזר טקסט ריק.',
    '',
    writeSummary(template, answers) || '(לא נרשם דבר)',
  ].join('\n');
}

/** What comes back from the model, made safe to store. */
export function readModelSummary(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  /* A model that answered with the prompt's own refusal wording, or with a
     single word, has not written a summary. Falling back to the plain one is
     better than putting "אין מספיק מידע" in a record somebody keeps. */
  if (text.length < 20) return '';
  return text.slice(0, 4000);
}

/** The whole thing: prose on top when there is any, the record underneath
 *  always. The record is the part that has to survive, so it is never
 *  replaced by the prose — only introduced by it. */
export function joinSummary(prose: string, record: string): string {
  if (!prose) return record;
  if (!record) return prose;
  return `${prose}\n\n${record}`;
}
