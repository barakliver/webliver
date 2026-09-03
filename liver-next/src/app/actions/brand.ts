'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { ACCENTS } from '@/content/brand';

export type BrandResult = { ok: boolean; error?: string };

const KEYS = new Set(ACCENTS.map((a) => a.key));

/**
 * A producer editing their own identity.
 *
 * The accent is checked against the shortlist here as well as being stored as
 * a key, because a key is only a key while something refuses the ones that are
 * not on the list. An unknown value falls back rather than being rejected: a
 * mangled colour should not stop somebody saving their brand name.
 *
 * The subdomain is the one field that can fail for a reason the person needs
 * to hear, since somebody else may already hold it. Everything else either
 * saves or is a bug.
 */
export async function saveBrand(_prev: BrandResult | null, form: FormData): Promise<BrandResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };

  const accentRaw = String(form.get('accent') ?? '');
  const slug = String(form.get('slug') ?? '').trim().toLowerCase();

  if (slug && !/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
    return { ok: false, error: 'השם הקצר בכתובת: אותיות באנגלית קטנות, ספרות ומקפים בלבד, בלי נקודות ורווחים. למשל eden-haimov.' };
  }

  const sb = await supabaseServer();
  const { error } = await sb
    .from('producers')
    .update({
      brand_name: String(form.get('brand_name') ?? '').trim().slice(0, 80),
      tagline: String(form.get('tagline') ?? '').trim().slice(0, 120),
      accent: KEYS.has(accentRaw) ? accentRaw : 'slate',
      whatsapp: String(form.get('whatsapp') ?? '').trim().slice(0, 40),
      booking_url: String(form.get('booking_url') ?? '').trim().slice(0, 300),
      slug: slug || null,
      /* Normalised in the database rather than here, so a pasted address gets
         the same treatment whichever screen it arrives from. */
      domain: String(form.get('domain') ?? '').trim() || null,
    })
    .eq('id', account.producer.id);

  if (error) {
    console.error('[brand] save failed', error);
    /* 23505 is a unique violation, which on this table means one of the two
       address fields is already somebody else's. */
    if (error.code === '23505') return { ok: false, error: 'הכתובת הזו כבר תפוסה.' };
    return { ok: false, error: 'לא הצלחנו לשמור. נסו שוב.' };
  }

  /* Branding is drawn by the shell, which wraps every screen. */
  revalidatePath('/app', 'layout');
  return { ok: true };
}
