/**
 * Why a write did not happen, in words the person can act on.
 *
 * Every failing write in this product ends in one of three sentences — "לא
 * הצלחנו לשמור", "לא הצלחנו לשמור את השינוי", or the same with "אפשר לנסות
 * שוב" on the end — and all three mean "something went wrong". That is true
 * and it is useless. A duplicate, a value the table refuses, a row that is no
 * longer there and a connection that dropped are four different situations
 * with four different next steps, and the database already said which one it
 * was.
 *
 * "Try again" in particular is advice that is right exactly once out of four.
 * On a duplicate it is wrong — trying again produces the same duplicate — and
 * the person tries three times before looking for what is already there.
 *
 * Permission is deliberately not handled here. `lib/rls.ts` already asks the
 * database the same four questions the policy asks and answers in much more
 * detail than a code could; a 42501 should go there rather than collect a
 * generic sentence from this file.
 *
 * Pure and tested, for the same reason `crewNeeds` and `bingo` are: the whole
 * value is in the mapping being right, and the mapping is not something you
 * can see by looking at a screen.
 */

export type WriteFailure =
  /** The row already exists. Trying again will not help. */
  | 'duplicate'
  /** A value the table will not accept. */
  | 'refused'
  /** It points at something that is not there — usually deleted in another tab. */
  | 'missing'
  /** The request never reached the database, or the answer never came back. */
  | 'offline'
  /** Something else. This is the only case that honestly means "try again". */
  | 'unknown';

/** What a Supabase error looks like at the point these are read. Loose on
 *  purpose: a fetch that never landed throws a TypeError with no code at all,
 *  and that is one of the cases worth telling apart. */
type Reported = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Postgres says this in `code`. The five-character SQLSTATE values are stable
 * across versions and are the only part of an error safe to branch on — the
 * message is English prose that changes between releases and is not something
 * to match against.
 */
export function classifyWrite(error: Reported): WriteFailure {
  if (!error) return 'unknown';
  const code = (error.code ?? '').trim();
  const message = (error.message ?? '').toLowerCase();

  if (code === '23505') return 'duplicate';
  if (code === '23503') return 'missing';
  if (code === '23514' || code === '23502' || code === '22P02' || code === '22001') return 'refused';

  /* PostgREST hands back its own codes rather than SQLSTATE. PGRST116 is
     "no rows where one was expected", which on an update means the row went
     away. */
  if (code === 'PGRST116') return 'missing';

  /* A request that never arrived has no code at all. `fetch failed` is what
     undici throws, and the Supabase client passes it through untouched. */
  if (!code && (message.includes('fetch failed') || message.includes('network')
                || message.includes('timeout') || message.includes('abort'))) {
    return 'offline';
  }
  /* Postgres' own class 08 is connection exception, which is the same story
     from the other end. */
  if (code.startsWith('08')) return 'offline';

  return 'unknown';
}

/* One sentence per situation, and each one names the next move rather than
   the fault. "Try again" appears exactly once, on the only case where it is
   the right advice. */
const SAYS = {
  he: {
    duplicate: 'זה כבר קיים ברשימה. כדאי לחפש אותו במקום להוסיף שוב.',
    refused: 'אחד הערכים לא התקבל. כדאי לעבור על השדות ולתקן.',
    missing: 'מה שזה מתחבר אליו כבר לא קיים. אולי נמחק בחלון אחר, ושווה לרענן.',
    offline: 'אין חיבור לשרת כרגע. מה שכתבתם נשאר על המסך, אפשר לשלוח שוב בעוד רגע.',
    unknown: 'לא הצלחנו לשמור. אפשר לנסות שוב.',
  },
  en: {
    duplicate: 'That is already on the list. Worth looking for it rather than adding it again.',
    refused: 'One of the values was not accepted. Worth going over the fields.',
    missing: 'What this connects to is no longer there. It may have been deleted in another window, so it is worth refreshing.',
    offline: 'No connection to the server right now. What you typed is still on screen; you can send it again in a moment.',
    unknown: 'That did not save. You can try again.',
  },
} as const;

/** The sentence for a failure, in the language the screen is in. */
export function whyNotSaved(error: Reported, locale: 'he' | 'en' = 'he'): string {
  return SAYS[locale][classifyWrite(error)];
}

/** Whether pressing the button again is honest advice. The screen uses this
 *  to decide between offering a retry and offering a refresh. */
export const worthRetrying = (error: Reported): boolean => {
  const kind = classifyWrite(error);
  return kind === 'offline' || kind === 'unknown';
};
