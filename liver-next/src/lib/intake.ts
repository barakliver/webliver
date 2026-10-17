/**
 * What the answers add up to, read on the screen before the trigger has.
 *
 * Pure and client-safe. The database derives the profile (0105) and that
 * is the copy every screen reads; this is the arithmetic the questionnaire
 * itself needs while somebody is answering: how far along a chapter is,
 * which answer is whose, and where the two partners disagree. The
 * completeness here is the same ratio the trigger writes, so the bar on
 * the screen and the card on the producer's side cannot say two numbers.
 */
import { INTAKE, INTAKE_KEY, INTAKE_QUESTIONS, type Chapter, type Question } from '../content/intake.ts';
import { WEDDING_DAY, WEDDING_DAY_KEY, WEDDING_DAY_QUESTIONS } from '../content/weddingDay.ts';

/** The two forms by key. The intake is the default everywhere, so a
 *  caller that names no form gets the one that existed first. */
export type Form = { key: string; chapters: readonly Chapter[]; questions: readonly Question[] };
export const FORMS: readonly Form[] = [
  { key: INTAKE_KEY, chapters: INTAKE, questions: INTAKE_QUESTIONS },
  { key: WEDDING_DAY_KEY, chapters: WEDDING_DAY, questions: WEDDING_DAY_QUESTIONS },
];
export const formOf = (key: string | null | undefined): Form => FORMS.find((f) => f.key === key) ?? FORMS[0];

export type Answer = {
  question_key: string;
  answered_by: string;
  value: unknown;
  visibility: 'couple' | 'private';
  updated_at?: string;
};

/** The answer a viewer reads for a question: their own when they wrote
 *  one, else their partner's when it is shared. Private answers are the
 *  writer's alone, which the policy also enforces; this only decides which
 *  of the rows that arrived is drawn. */
export function answerFor(answers: readonly Answer[], key: string, viewer: string): Answer | null {
  const rows = answers.filter((a) => a.question_key === key);
  return rows.find((a) => a.answered_by === viewer) ?? rows.find((a) => a.visibility === 'couple') ?? null;
}

export const isAnswered = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(isAnswered);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(isAnswered);
  return true;
};

/** Answered questions over all of them, 0 to 1, to two places: the same
 *  figure the trigger writes. A chapter's share counts the chapter alone. */
export function completeness(answers: readonly Answer[], chapter?: Chapter, form: Form = FORMS[0]): number {
  const qs = chapter ? chapter.questions : form.questions;
  const done = new Set(answers.filter((a) => isAnswered(a.value)).map((a) => a.question_key));
  const n = qs.filter((q) => done.has(q.key)).length;
  return qs.length === 0 ? 0 : Math.round((n / qs.length) * 100) / 100;
}

/** How many questions are still open, for the card on the couple's
 *  screen that says "n more and we know you". */
export function openCount(answers: readonly Answer[], form: Form = FORMS[0]): number {
  const done = new Set(answers.filter((a) => isAnswered(a.value)).map((a) => a.question_key));
  return form.questions.filter((q) => !done.has(q.key)).length;
}

/** The first chapter with something still unanswered, where "continue"
 *  takes a couple to. Null once everything is answered. */
export function nextChapter(answers: readonly Answer[], form: Form = FORMS[0]): Chapter | null {
  return form.chapters.find((c) => completeness(answers, c) < 1) ?? null;
}

export type Gap = { key: string; a: Answer; b: Answer };

/** Where the two partners answered the same shared question differently.
 *  Only shared questions: the private chapter is meant to differ. */
export function gaps(answers: readonly Answer[], form: Form = FORMS[0]): Gap[] {
  const out: Gap[] = [];
  for (const q of form.questions) {
    const rows = answers.filter((a) => a.question_key === q.key && a.visibility === 'couple' && isAnswered(a.value));
    if (rows.length < 2) continue;
    const [a, b] = rows;
    if (JSON.stringify(norm(a.value)) !== JSON.stringify(norm(b.value))) out.push({ key: q.key, a, b });
  }
  return out;
}

const norm = (v: unknown): unknown => {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(norm);
  return v;
};

/** An answer as one line of text, for the producer's card and the brief. */
export function answerText(q: Question, value: unknown, locale: 'he' | 'en' = 'he'): string {
  const label = (v: string) => {
    const o = q.options?.find((x) => x.value === v) ?? q.items?.find((x) => x.value === v);
    return o ? (locale === 'en' ? o.en : o.he) : v;
  };
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return q.type === 'single' ? label(value) : value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (q.type === 'people') return value.map((p) => { const x = p as { name?: string; relation?: string; role?: string }; return [x.name, x.relation, x.role].filter(Boolean).join(', '); }).filter(Boolean).join(' · ');
    if (q.type === 'table') return value.map((r) => Object.values((r ?? {}) as Record<string, unknown>).map((x) => String(x ?? '').trim()).filter(Boolean).join(', ')).filter(Boolean).join(' · ');
    return value.map((v) => (typeof v === 'string' ? label(v) : String(v))).filter(Boolean).join(' · ');
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (q.type === 'date_range') return [o.from, o.to].filter(Boolean).join(' עד ');
    if (q.type === 'scale') return Object.entries(o).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${label(k)} ${n}`).join(' · ');
    return JSON.stringify(o);
  }
  return String(value);
}

/** The profile's reading of the answers, for a screen that has the rows
 *  and not the derived table yet (the trigger runs after the write, and
 *  the first render after the first answer wants the right greeting). */
export function nicknameOf(answers: readonly Answer[]): string {
  const a = answers.find((x) => x.question_key === 'a1_nickname' && isAnswered(x.value));
  return a ? String(a.value).trim() : '';
}
