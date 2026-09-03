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

/* ── the three pictures ─────────────────────────────────────────────────── */

export type BrandAsset = 'logo' | 'icon' | 'cover';

/** What each picture may be. The limits are the ones the screen states next
 *  to the button, so the refusal and the rule are never two different
 *  numbers. The icon refuses SVG on purpose: a home screen wants a raster,
 *  and iOS ignores anything else. */
const RULES: Record<BrandAsset, { max: number; types: string[]; column: 'logo_url' | 'icon_url' | 'cover_url' }> = {
  logo:  { max: 2 * 1024 * 1024, types: ['image/png', 'image/svg+xml', 'image/webp'], column: 'logo_url' },
  icon:  { max: 1 * 1024 * 1024, types: ['image/png'], column: 'icon_url' },
  cover: { max: 5 * 1024 * 1024, types: ['image/jpeg', 'image/webp', 'image/png'], column: 'cover_url' },
};

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/jpeg': 'jpg',
};

const isAsset = (v: string): v is BrandAsset => v === 'logo' || v === 'icon' || v === 'cover';

/**
 * One picture of the brand, put where every page can draw it.
 *
 * Through a server action rather than straight from the browser, because
 * these are small by rule and the row has to change in the same breath: a
 * logo in the bucket with no column pointing at it is a logo nobody sees.
 *
 * The object is named by kind rather than by a random id, and replaced in
 * place, so a producer who changes their logo four times does not leave four
 * logos behind. The address the row keeps carries a version stamp, which is
 * what makes a cached copy on somebody's phone notice the change.
 */
export async function uploadBrandAsset(_prev: BrandResult | null, form: FormData): Promise<BrandResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };

  const kind = String(form.get('kind') ?? '');
  if (!isAsset(kind)) return { ok: false, error: 'סוג קובץ לא מוכר' };
  const rule = RULES[kind];

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'נא לבחור קובץ' };
  if (file.size > rule.max) return { ok: false, error: `הקובץ גדול מדי. עד ${Math.round(rule.max / 1024 / 1024)}MB.` };
  if (!rule.types.includes(file.type)) return { ok: false, error: 'סוג הקובץ הזה לא מתאים כאן.' };

  const sb = await supabaseServer();
  const path = `${account.producer.id}/${kind}.${EXT[file.type] ?? 'png'}`;

  const { error: upErr } = await sb.storage.from('brand').upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) {
    console.error('[brand] asset upload failed', upErr);
    return { ok: false, error: 'ההעלאה נכשלה. נסו שוב.' };
  }

  const { data: pub } = sb.storage.from('brand').getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now().toString(36)}`;

  const { error } = await sb
    .from('producers')
    .update({ [rule.column]: url })
    .eq('id', account.producer.id);
  if (error) {
    console.error('[brand] asset row update failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור. נסו שוב.' };
  }

  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function removeBrandAsset(form: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account?.producer) return;

  const kind = String(form.get('kind') ?? '');
  if (!isAsset(kind)) return;
  const rule = RULES[kind];

  const sb = await supabaseServer();
  const { error } = await sb
    .from('producers')
    .update({ [rule.column]: null })
    .eq('id', account.producer.id);
  if (error) { console.error('[brand] asset clear failed', error); return; }

  /* Every extension the kind may have been stored under. A miss costs
     nothing; a leftover object would sit in the bucket forever. */
  const key = (t: string) => `${account.producer!.id}/${kind}.${EXT[t] ?? 'png'}`;
  await sb.storage.from('brand').remove(rule.types.map(key));

  revalidatePath('/app', 'layout');
}
