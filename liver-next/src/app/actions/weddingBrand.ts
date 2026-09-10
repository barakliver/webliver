'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { noteFailure } from '@/lib/flash';
import { readBrand, PIECE_KEYS, type PieceKey } from '@/content/brandKit';

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath(`/app/clients/${clientId}/preview`);
  revalidatePath('/app/portal');
}

export type WeddingBrandResult = { ok: boolean; error?: string };

/** The brand sheet, saved whole. The producer's row policy is the check: a
 *  couple's session has no write on clients and gets an error, not a save.
 *  The sheet goes through the same reader the screens use, so nothing lands
 *  in the column that the column's readers would then drop. */
export async function saveWeddingBrand(_prev: WeddingBrandResult | null, form: FormData): Promise<WeddingBrandResult> {
  const clientId = String(form.get('client_id') ?? '');
  let parsed: unknown;
  try { parsed = JSON.parse(String(form.get('brand') ?? '')); } catch { parsed = null; }
  const brand = readBrand(parsed);
  if (!clientId || !brand) return { ok: false, error: 'חסר מה לשמור' };

  const sb = await supabaseServer();
  /* The picks are the couple's too, and they may have picked since this
     form was opened; theirs win over a stale copy in the producer's tab. */
  const { data: row } = await sb.from('clients').select('brand').eq('id', clientId).maybeSingle();
  const current = readBrand(row?.brand);
  const picks = { ...(current?.picks ?? {}), ...brand.picks };

  const { error } = await sb.from('clients')
    .update({ brand: { ...brand, picks, at: new Date().toISOString() } })
    .eq('id', clientId);
  if (error) {
    console.error('[brand] save failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את דף המותג. אפשר לנסות שוב.' };
  }
  touch(clientId);
  return { ok: true };
}

/** One piece, one option, from either side. Goes through the definer
 *  function because the couple has no write on the row. */
export async function pickBrandVariant(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const piece = String(form.get('piece') ?? '');
  const variant = String(form.get('variant') ?? '');
  if (!clientId || !(PIECE_KEYS as string[]).includes(piece) || (variant !== 'safe' && variant !== 'bold')) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('pick_brand_variant', { p_client: clientId, p_piece: piece as PieceKey, p_variant: variant });
  if (error) {
    console.error('[brand] pick failed', error);
    await noteFailure('לא הצלחנו לשמור את הבחירה. אפשר לנסות שוב.');
  }
  touch(clientId);
}
