/**
 * Which language the site is being read in.
 *
 * Two things, and they are not the same thing: the language the words are in,
 * and the direction the page runs. Hebrew is read right to left and English
 * left to right, so a locale carries both and every component asks for the one
 * it needs rather than assuming.
 *
 * Deliberately not a library. The whole public site's copy is one typed object,
 * so a second language is a second object of the same shape — and a routing
 * layer, a message catalogue and a build step would all be machinery for a
 * problem that does not exist here.
 */

export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'he';

/** The cookie the choice is kept in. Named plainly because a person clearing
 *  cookies should be able to tell what this one does. */
export const LOCALE_COOKIE = 'liver-lang';

/** A year. Long enough that somebody who chose English once does not have to
 *  choose again, short enough to expire on a shared machine. */
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

/** Anything that is not a language this site has becomes the one it started
 *  in. A cookie is a value a browser sends, so it is checked rather than
 *  trusted, and a page in a language nobody wrote is worse than Hebrew. */
export function readLocale(value: string | undefined | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

/** What each language calls the other, in its own script. A toggle that says
 *  "English" in Hebrew letters helps nobody find English. */
export const LOCALE_LABEL: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
};

/** The short form, for a toggle with no room. */
export const LOCALE_SHORT: Record<Locale, string> = {
  he: 'עב',
  en: 'EN',
};

export const OTHER: Record<Locale, Locale> = { he: 'en', en: 'he' };
