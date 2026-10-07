'use server';

import { whyNotSaved } from '@/lib/writeFailure';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { todayInZone } from '@/lib/clock';
import { parseIls } from '@/lib/money';

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
  const amount = parseIls(form.get('amount') as string | null) ?? NaN;
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

/**
 * Correcting a line after it was written.
 *
 * This panel had add and delete and nothing between them, which on this
 * table is worse than it sounds. The sheet's own words are that the thing
 * most often recorded here is the one with no file to attach it to — so the
 * ordinary life of an entry is to be written against no event in the car
 * park and attached to one a week later, and the only way to do that was to
 * delete the line and retype five fields from memory. A record of money that
 * has to be retyped to be corrected stops being a record of money.
 *
 * `kind` is editable too, because a tip typed into the wrong half of the
 * toggle is the mistake this form exists for.
 */
export async function updateLedgerEntry(_prev: LedgerResult | null, form: FormData): Promise<LedgerResult> {
  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: 'אין מרחב הפקה פעיל' };

  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה רישום' };

  const kind = String(form.get('kind') ?? '') === 'expense' ? 'expense' : 'income';
  const amount = parseIls(form.get('amount') as string | null) ?? NaN;
  const label = String(form.get('label') ?? '').trim().slice(0, 120);
  const clientId = String(form.get('client_id') ?? '').trim() || null;
  const party = String(form.get('party') ?? '').trim().slice(0, 120);
  const note = String(form.get('note') ?? '').trim().slice(0, 500);
  const onRaw = String(form.get('on_date') ?? '').trim();
  const onDate = /^\d{4}-\d{2}-\d{2}$/.test(onRaw) ? onRaw : todayInZone();

  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'הסכום צריך להיות מספר גדול מאפס' };
  if (!label) return { ok: false, error: 'על מה זה?' };

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('producer_ledger')
    .update({ kind, amount, label, client_id: clientId, party, note, on_date: onDate })
    .eq('id', id)
    .eq('producer_id', producerId)
    .select('id');

  if (error) {
    console.error('[ledger] update failed', { message: error.message });
    return { ok: false, error: 'לא נשמר. אפשר לנסות שוב.' };
  }
  /* An update that matched no row must not report success: the screen would
     say saved and go on showing the old figure. */
  if (!data || data.length === 0) {
    /* Not a fault: the row is gone, and in practice it was deleted in
       another tab. The classifier has the sentence for that, so this hands
       it the code PostgREST uses for "no rows where one was expected"
       rather than inventing a second way of saying it. */
    return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  }

  /* The event may have moved, so both ends are stale. */
  touch(clientId);
  const was = String(form.get('was_client_id') ?? '').trim() || null;
  if (was && was !== clientId) touch(was);
  return { ok: true };
}
