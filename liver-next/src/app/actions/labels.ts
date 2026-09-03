'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { safeColor } from '@/content/palette';
import { labelCopy as c } from '@/content/site';

export type LabelResult = { ok: boolean; error?: string };
export type LabelKind = 'event_tag' | 'lead_channel';

export type ProducerLabel = {
  id: string; kind: LabelKind; label: string; color: string; sort_order: number;
};

const isKind = (v: string): v is LabelKind => v === 'event_tag' || v === 'lead_channel';

function touch() {
  revalidatePath('/app/calendar');
  revalidatePath('/app/leads');
  revalidatePath('/app/brand');
  revalidatePath('/app/clients', 'layout');
}

/** A producer's own word for something, with a colour on it. Both taxonomies
 *  come through here; `kind` is the only thing that differs. */
export async function addLabel(_prev: LabelResult | null, form: FormData): Promise<LabelResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };

  const kind = String(form.get('kind') ?? '');
  if (!isKind(kind)) return { ok: false, error: c.failed };

  const label = String(form.get('label') ?? '').trim();
  if (!label) return { ok: false, error: c.needName };
  if (label.length > 40) return { ok: false, error: c.tooLong };

  const sb = await supabaseServer();
  /* Appended rather than inserted at the top: the order a producer built
     their list in is the order they read it in. */
  const { data: last } = await sb
    .from('producer_labels')
    .select('sort_order')
    .eq('producer_id', account.producer.id).eq('kind', kind)
    .order('sort_order', { ascending: false })
    .limit(1).maybeSingle();

  const { error } = await sb.from('producer_labels').insert({
    producer_id: account.producer.id,
    kind,
    label,
    color: safeColor(String(form.get('color') ?? '')),
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    console.error('[labels] insert failed', error);
    if (error.code === '23505') return { ok: false, error: c.taken };
    return { ok: false, error: c.failed };
  }
  touch();
  return { ok: true };
}

export async function updateLabel(_prev: LabelResult | null, form: FormData): Promise<LabelResult> {
  const id = String(form.get('label_id') ?? '');
  if (!id) return { ok: false, error: c.failed };

  const label = String(form.get('label') ?? '').trim();
  if (!label) return { ok: false, error: c.needName };
  if (label.length > 40) return { ok: false, error: c.tooLong };

  const sb = await supabaseServer();
  /* The policy scopes this to the producer's own rows, so there is nothing
     to check here beyond the shape. */
  const { error } = await sb
    .from('producer_labels')
    .update({ label, color: safeColor(String(form.get('color') ?? '')) })
    .eq('id', id);

  if (error) {
    console.error('[labels] update failed', error);
    if (error.code === '23505') return { ok: false, error: c.taken };
    return { ok: false, error: c.failed };
  }
  touch();
  return { ok: true };
}

/** Deleted rather than archived: a colour nobody uses is noise in a legend,
 *  and the events that carried it keep their row and lose only the tint. */
export async function removeLabel(form: FormData): Promise<void> {
  const id = String(form.get('label_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('producer_labels').delete().eq('id', id);
  if (error) console.error('[labels] delete failed', error);
  touch();
}

/** The colour on one event. An empty value clears it. */
export async function setEventLabel(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const labelId = String(form.get('label_id') ?? '').trim();
  if (!clientId) return;

  const sb = await supabaseServer();
  const { error } = await sb
    .from('clients')
    .update({ label_id: labelId || null })
    .eq('id', clientId);
  if (error) console.error('[labels] event tag failed', error);
  touch();
}
