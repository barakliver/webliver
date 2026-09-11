import 'server-only';
import { cookies } from 'next/headers';
import type { Locale } from './locale';

/**
 * What a screen says when a write did not happen.
 *
 * A hundred and twenty four server actions in this product, and sixteen of
 * them return nothing at all: they log the failure and revalidate, so the
 * screen redraws exactly as it was and the person who pressed the button is
 * told nothing. Press revoke on a signing link that will not revoke and the
 * link is still listed — which reads as "it did not register my click", not as
 * "the link is still live". That one is a security notice being swallowed.
 *
 * The obvious fix is to give all sixteen a return type and thread
 * `useActionState` through a dozen components. That is a large change to a
 * dozen working screens for one sentence each, and half of those actions are
 * plain `<form action={fn}>` submissions with no state to hang it on.
 *
 * So: one line, set by the action and rendered by the shell. The docs are
 * explicit that a cookie set inside a server action is visible to the
 * re-render that follows it in the same roundtrip, which is exactly the shape
 * of every one of these — write, revalidate, redraw.
 *
 * Only ever UI copy. Never a row, an id, a database message or anything a
 * person did not already have on their screen: this cookie is readable by the
 * page's own scripts, because that is how it clears itself after being shown
 * once.
 */
/* `__Host-` is not decoration. Without it a cookie of this name can be set
   with a Domain attribute by anything on liverproductions.com — and the main
   site on that domain is a WordPress install, which is a different security
   story from this one. The prefix makes the browser refuse any such cookie:
   it may only be set by this exact host, only over HTTPS, and only at path /.
   Nothing worse than a wrong sentence could have come through, because the
   message is React-escaped and only ever one of a fixed set. It is still not
   an opening this product needs to leave. */
const NAME = '__Host-liver-said';

/* Long enough to survive the redraw that follows the action, short enough that
   a message nobody's browser managed to clear is gone by the time they come
   back. The client clears it on sight; this is the floor under that. */
const SECONDS = 30;

/** Which of the two kinds of sentence this is. A failure is a red line; a
 *  confirmation is a quiet one. The tone travels in the cookie rather than
 *  being guessed from the words, because the shell that draws it has only the
 *  words. */
export type FlashTone = 'bad' | 'ok';

export async function noteFailure(text: string): Promise<void> {
  return note('bad', text);
}

/**
 * What happened, when what happened is not visible on the screen it happened
 * on.
 *
 * Sparingly. A save whose result is the screen redrawing with the new value
 * needs no sentence, and a product that says "saved" after every press is a
 * product that has taught everybody to ignore it. This is for the writes
 * whose effect is real and elsewhere: deciding what an account is opens a
 * workspace for somebody, on a screen that cannot show it.
 */
export async function noteDone(text: string): Promise<void> {
  return note('ok', text);
}

async function note(tone: FlashTone, text: string): Promise<void> {
  try {
    (await cookies()).set(NAME, encodeURIComponent(`${tone}|${text}`), {
      maxAge: SECONDS,
      path: '/',
      sameSite: 'lax',
      /* Required by the __Host- prefix, and right on its own now that the
         platform is only reachable over HTTPS. */
      secure: true,
      /* Readable on purpose. The shell shows it and then deletes it, which is
         what stops the same sentence appearing on the next three screens. */
      httpOnly: false,
    });
  } catch {
    /* Called outside a server action — nothing to set, and the caller's own
       console.error already recorded the real failure. */
  }
}

export async function readFlash(): Promise<{ text: string; tone: FlashTone }> {
  const raw = (await cookies()).get(NAME)?.value ?? '';
  if (!raw) return { text: '', tone: 'bad' };
  try {
    const said = decodeURIComponent(raw);
    /* The tone is a prefix rather than a second cookie, and a value written
       before this existed has none — those were all failures, which is what
       an unmarked sentence still means. */
    const cut = said.indexOf('|');
    const tone: FlashTone = said.slice(0, cut) === 'ok' ? 'ok' : 'bad';
    return { text: (cut === -1 ? said : said.slice(cut + 1)).slice(0, 200), tone };
  } catch {
    return { text: '', tone: 'bad' };
  }
}

export const FLASH_COOKIE = NAME;

/* The producer's console is Hebrew on purpose and its actions say so directly.
   These are for the writes a couple can now reach — the roster and the looks
   are theirs to edit, so a failure has to speak their language. */
const SAID = {
  he: {
    notSaved: 'לא הצלחנו לשמור. אפשר לנסות שוב.',
    notRemoved: 'לא הצלחנו למחוק. אפשר לנסות שוב.',
    linkNotMade: 'לא הצלחנו ליצור קישור. אפשר לנסות שוב.',
    linkNotRevoked: 'הקישור לא בוטל. הוא עדיין פעיל. אפשר לנסות שוב.',
  },
  en: {
    notSaved: 'That did not save. You can try again.',
    notRemoved: 'That did not delete. You can try again.',
    linkNotMade: 'The link was not created. You can try again.',
    linkNotRevoked: 'The link was not revoked. It is still live. You can try again.',
  },
} as const;

export const saidFor = (l: Locale) => (l === 'en' ? SAID.en : SAID.he);
