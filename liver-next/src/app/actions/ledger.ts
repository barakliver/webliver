'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { todayInZone } from '@/lib/clock';

export type LedgerResult = { ok: boolean; error?: string };

function touch(clientId: string | null) {
  if (clientId) revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/insights');
  revalidatePath('/app');
}

/** One line of the producer's own money. Tied to an event when one was
 *  chosen; otherwise the name of who it was with is the whole record. */
export async function addLedgerEntry(_prev: LedgerResult | null, form: FormData): Promise<LedgerResult> {
  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: 'אין מרחב הפקה פעיל' };

  const kind = String(form.get('kind') ?? '') === 'expense' ? 'expense' : 'income';
  const amount = Number(String(form.get('amount') ?? '').replace(/[^\d.]/g, ''));
  const label = String(form.get('label') ?? '').trim().slice(0, 120);
  const clientId = String(form.get('client_id') ?? '').trim() || null;
  const party = String(form.get('party') ?? '').trim().slice(0, 120);
  const note = String(form.get('note') ?? '').trim().slice(0, 500);
  const onRaw = String(form.get('on_date') ?? '').trim();
  const onDate = /^\d{4}-\d{2}-\d{2}$/.test(onRaw) ? onRaw : todayInZone();

  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'הסכום צריך להיות מספר גדול מאפס' };
  if (!label) return { ok: false, error: 'על מה זה?' };

  const sb = await supabaseServer();
  const { error } = await sb.from('producer_ledger').insert({
    producer_id: producerId, client_id: clientId, kind, amount, label, party, note,
    on_date: onDate, created_by: account.id,
  });
  if (error) {
    console.error('[ledger] insert failed', { message: error.message });
    return { ok: false, error: 'לא נרשם. אפשר לנסות שוב.' };
  }
  touch(clientId);
  return { ok: true };
}

export async function removeLedgerEntry(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '') || null;
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('producer_ledger').delete().eq('id', id);
  if (error) {
    console.error('[ledger] delete failed', { message: error.message });
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  }
  touch(clientId);
}
