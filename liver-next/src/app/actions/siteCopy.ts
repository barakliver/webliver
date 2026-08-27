'use server';

import { revalidatePath } from 'next/cache';
import { forgetSiteCopy } from '@/lib/siteCopy';
import { supabaseServer } from '@/lib/supabase/server';
import { EDITABLE_KEYS } from '@/content/editable';

export type CopyResult = { ok: boolean; error?: string; key?: string; reset?: boolean };

/**
 * Changing one sentence on the public site.
 *
 * The key is checked against the list the editor offers rather than trusted.
 * A free-form key would let a typo write a value nothing ever reads and look
 * like it worked, and the person typing would find out weeks later that the
 * sentence they changed is still the old one.
 *
 * An empty value is a reset, not a blank sentence. The database deletes the
 * row, the shipped wording comes back, and "put it back the way it was" stays
 * a button rather than a support conversation.
 */
export async function saveSiteCopy(_prev: CopyResult | null, form: FormData): Promise<CopyResult> {
  const key = String(form.get('key') ?? '');
  const value = String(form.get('value') ?? '');

  if (!EDITABLE_KEYS.has(key)) {
    console.error('[site] refused an unknown copy key', { key });
    return { ok: false, error: 'השדה הזה לא ניתן לעריכה' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.rpc('set_site_content', { p_key: key, p_value: value.slice(0, 4000) });

  if (error) {
    console.error('[site] save failed', { key, code: error.code, message: error.message });
    if (/insufficient_privilege|אין הרשאה/i.test(`${error.code} ${error.message}`)) {
      return { ok: false, error: 'אין לך הרשאה לערוך את האתר' };
    }
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }

  /* The public page is cached so a visitor does not pay for this lookup. An
     edit is the one moment it has to be thrown away, and both pages that read
     the copy are named rather than guessed at. */
  /* The public page reads the overrides through a five minute memo now, so
     clearing the route alone would leave the old sentence up for as much as
     five more minutes. Both, in this order: forget the copy, then rebuild the
     page that renders it. */
  forgetSiteCopy();
  revalidatePath('/');
  revalidatePath('/app/site');

  return { ok: true, key, reset: value.trim() === '' };
}
