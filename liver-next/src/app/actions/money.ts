'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type MoneyResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
}

function amountOf(raw: string): number | null {
  const n = Number(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function addPayment(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const clientId = String(form.get('client_id') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const amount = amountOf(String(form.get('amount') ?? ''));
  const dueOn = String(form.get('due_on') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (title.length < 2) return { ok: false, error: 'נא לכתוב על מה התשלום' };
  if (amount === null) return { ok: false, error: 'הסכום צריך להיות גדול מאפס' };

  const sb = await supabaseServer();
  const { error } = await sb.from('payments').insert({
    client_id: clientId, title, amount, due_on: dueOn || null,
  });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את התשלום' };

  touch(clientId);
  return { ok: true };
}

/** Marking a payment settled is the producer's call, so a couple reaching this
 *  action changes nothing: the row is invisible to their update under policy. */
export async function togglePaid(form: FormData): Promise<void> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const paid = String(form.get('paid') ?? '') === 'true';
  if (!id) return;

  const sb = await supabaseServer();
  /* paid_on is set and cleared by the database, so it can never drift out of
     step with the flag no matter which screen wrote it */
  await sb.from('payments').update({ paid: !paid }).eq('id', id);
  touch(clientId);
}

export async function deletePayment(form: FormData): Promise<void> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('payments').delete().eq('id', id);
  touch(clientId);
}

export async function addBudgetItem(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const clientId = String(form.get('client_id') ?? '');
  const label = String(form.get('label') ?? '').trim();
  const estimate = Number(String(form.get('estimate') ?? '').replace(/[^\d.-]/g, ''));
  const agreedRaw = String(form.get('agreed') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (label.length < 2) return { ok: false, error: 'נא לכתוב על מה הסעיף' };
  if (!Number.isFinite(estimate) || estimate < 0) return { ok: false, error: 'אומדן לא תקין' };

  const agreed = agreedRaw ? Number(agreedRaw.replace(/[^\d.-]/g, '')) : null;
  if (agreed !== null && (!Number.isFinite(agreed) || agreed < 0)) {
    return { ok: false, error: 'סכום שנסגר לא תקין' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('budget_items').insert({
    client_id: clientId,
    category: String(form.get('category') ?? '').trim(),
    label, estimate, agreed,
    vendor: String(form.get('vendor') ?? '').trim(),
  });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את הסעיף' };

  touch(clientId);
  return { ok: true };
}

export async function deleteBudgetItem(form: FormData): Promise<void> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('budget_items').delete().eq('id', id);
  touch(clientId);
}

/** Whether the couple may see the budget at all. Off by default, because a
 *  working budget carries the producer's own margins. */
export async function toggleBudgetVisible(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const visible = String(form.get('visible') ?? '') === 'true';
  if (!clientId) return;
  const sb = await supabaseServer();
  await sb.from('clients').update({ budget_visible: !visible }).eq('id', clientId);
  touch(clientId);
}
