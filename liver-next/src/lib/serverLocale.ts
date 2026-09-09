import { cookies } from 'next/headers';
import { LOCALE_COOKIE, readLocale, type Locale } from './locale';
import { EVENT_ZONE } from './clock.ts';
import { appUiFor, type AppUi } from '../content/appUi.ts';

/**
 * The language this request is being read in.
 *
 * Three lines, written once, because it was about to be written out in seven
 * places: read the cookie, check it, fall back. The check matters more than it
 * looks. A cookie is a value the browser sends, so `liver-lang` can say
 * anything at all, and `readLocale` is what stops it selecting a language
 * nobody wrote copy for.
 *
 * Separate from `lib/locale` on purpose: that module is pure and is imported by
 * the tests, and `next/headers` cannot be imported outside a request.
 */
export async function currentLocale(): Promise<Locale> {
  return readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/** The words for this request, for a server component or a page. The client
 *  components read the same object from the provider; this is the server
 *  side of the same door, and the two always agree because the layout hands
 *  the provider exactly this. */
export async function serverCopy(): Promise<AppUi> {
  return appUiFor(await currentLocale());
}

/** The date format each language expects. A policy that says it was updated on
 *  08/31/2026 to a British reader, or on 31.08.2026 to nobody in particular,
 *  is a small tell that the page was translated rather than written. */
export function dateFormat(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
