import type { Locale } from './locale';

/**
 * Date and time formatters that follow the reader's language.
 *
 * Every one of these was `new Intl.DateTimeFormat('he-IL', …)` at module level,
 * which is right until the same component has to render for somebody reading
 * English: the panel comes out in English with a Hebrew month inside it, which
 * is the half translated screen this whole pass exists to remove.
 *
 * Built per call rather than cached. `Intl.DateTimeFormat` construction is
 * cheap, these run once per render of a list rather than once per row, and a
 * cache keyed on a string is more code than it saves here.
 *
 * A written out date must never be wrapped in an ltr isolate, in either
 * language: `15 באוקטובר 2025` comes back as `באוקטובר 2025 15` the moment it
 * is. `scripts/check-bidi.mjs` refuses that.
 */
const tag = (locale: Locale) => (locale === 'en' ? 'en-GB' : 'he-IL');

/** `15 באוקטובר 2025` / `15 October 2025` */
export const longDate = (locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'long', year: 'numeric' });

/** `15 באוקטובר` / `15 October` */
export const dayMonth = (locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'long' });

/** `15.10.25` / `15/10/25`, for a column where a written out month would not
 *  fit. Two digit year on purpose: these sit in a due-date column beside a
 *  task, where the century is not in doubt. */
export const shortDate = (locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: '2-digit', month: '2-digit', year: '2-digit' });

/** `21:30`. The digits are the same everywhere; the locale still decides
 *  whether a twelve hour clock shows up. */
export const clock = (locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { hour: '2-digit', minute: '2-digit' });

/** `יום שלישי, 15 באוקטובר 2025` / `Tuesday 15 October 2025`. The weekday is
 *  worth its width on the one line that says when the wedding is. */
export const weekdayDate = (locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** When a signature was given: the date written out, and the time, because a
 *  signature is an event and not a day. */
export const signedAt = (locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
