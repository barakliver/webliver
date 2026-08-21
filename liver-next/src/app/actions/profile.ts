'use server';

import { revalidatePath } from 'next/cache';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';

export type ProfileResult = { ok: boolean; error?: string };

/** Name and picture. Role is deliberately not settable here, and the database
 *  refuses it independently — freeze_own_role() raises rather than trusting
 *  this function to have left it out. */
export async function saveProfile(
  _prev: ProfileResult | null,
  form: FormData,
): Promise<ProfileResult> {
  const account = await requireAccount();
  const fullName = String(form.get('full_name') ?? '').trim();

  if (fullName.length < 2) return { ok: false, error: 'שם קצר מדי' };
  if (fullName.length > 80) return { ok: false, error: 'שם ארוך מדי' };

  const sb = await supabaseServer();
  const { error } = await sb
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', account.id);

  if (error) return { ok: false, error: 'לא הצלחנו לשמור. נסו שוב.' };

  revalidatePath('/app', 'layout');
  return { ok: true };
}

/** Called after the browser has put the file in storage. The upload itself
 *  goes straight from the device to Supabase rather than through this server:
 *  a photo from a modern phone is several megabytes, and routing it through a
 *  1GB droplet to hand back to the same storage bucket buys nothing. Storage
 *  policy is what makes that safe — a person may only write under their own
 *  id, checked by the database, not by this code. */
export async function setAvatar(url: string | null): Promise<ProfileResult> {
  const account = await requireAccount();

  if (url !== null) {
    /* Only ever our own storage host, so this cannot be pointed at a tracking
       pixel or an image that changes under us later. */
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (!base || !url.startsWith(`${base}/storage/v1/object/public/avatars/${account.id}/`)) {
      return { ok: false, error: 'כתובת תמונה לא תקינה' };
    }
  }

  const sb = await supabaseServer();
  const { error } = await sb
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', account.id);

  if (error) return { ok: false, error: 'לא הצלחנו לשמור את התמונה' };

  revalidatePath('/app', 'layout');
  return { ok: true };
}
