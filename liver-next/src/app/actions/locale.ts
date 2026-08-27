'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, LOCALE_MAX_AGE, readLocale } from '@/lib/locale';

/**
 * Choosing a language.
 *
 * A cookie rather than a path, and that is a decision worth stating. `/en/...`
 * would mean every route in the product existing twice, every link knowing
 * which half it is in, and the app and the couple's portal — which are Hebrew
 * and are staying Hebrew — carrying a prefix that means nothing there. What is
 * actually bilingual is the public site, and the public site is one page.
 *
 * A form action rather than a script, so the switch works with JavaScript off
 * and is a real navigation rather than a client re-render: `dir` lives on
 * `<html>`, and the whole document has to be re-rendered to flip it.
 */
export async function setLocale(form: FormData): Promise<void> {
  const next = readLocale(String(form.get('lang') ?? ''));
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    maxAge: LOCALE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    /* Read by the server on every render, so it has no business being visible
       to script. */
    httpOnly: true,
  });
  /* The layout is what reads it, so the layout is what has to be rebuilt. */
  revalidatePath('/', 'layout');
}
