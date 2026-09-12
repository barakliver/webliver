'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { noteFailure } from '@/lib/flash';
import { parseIls } from '@/lib/money';

export type MoneyResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
}

/* One parser for every amount in the product, in `lib/money`, because there
   were four of these and they disagreed: one stripped the minus sign, one
   kept it, and one rounded to the whole shekel. A payment is the one that
   has to be positive, which is the only thing left here. */
function amountOf(raw: string): number | null {
  const n = parseIls(raw);
  return n !== null && n > 0 ? n : null;
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
  const { error } = await sb.from('payments').update({ paid: !paid }).eq('id', id);
  if (error) {
    console.error('[money] togglePaid failed', error);
    await noteFailure('התשלום לא סומן. אפשר לנסות שוב.');
  }
  touch(clientId);
}

export async function deletePayment(form: FormData): Promise<void> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('payments').delete().eq('id', id);
  if (error) {
    console.error('[money] deletePayment failed', error);
    await noteFailure('התשלום לא נמחק. אפשר לנסות שוב.');
  }
  touch(clientId);
}

export async function addBudgetItem(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const clientId = String(form.get('client_id') ?? '');
  const label = String(form.get('label') ?? '').trim();
  const estimate = parseIls(form.get('estimate') as string | null);
  const agreedRaw = String(form.get('agreed') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (label.length < 2) return { ok: false, error: 'נא לכתוב על מה הסעיף' };
  if (estimate === null || estimate < 0) return { ok: false, error: 'אומדן לא תקין' };

  const agreed = agreedRaw ? parseIls(agreedRaw) : null;
  if (agreedRaw && (agreed === null || agreed < 0)) {
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
  const { error } = await sb.from('budget_items').delete().eq('id', id);
  if (error) {
    console.error('[money] deleteBudgetItem failed', error);
    await noteFailure('השורה לא נמחקה. אפשר לנסות שוב.');
  }
  touch(clientId);
}

/** Whether the couple may see the budget at all. Off by default, because a
 *  working budget carries the producer's own margins. */
export async function toggleBudgetVisible(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const visible = String(form.get('visible') ?? '') === 'true';
  if (!clientId) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('clients').update({ budget_visible: !visible }).eq('id', clientId);
  if (error) {
    console.error('[money] toggleBudgetVisible failed', error);
    await noteFailure('לא הצלחנו לשנות מי רואה את התקציב. אפשר לנסות שוב.');
  }
  touch(clientId);
}

/** The one figure on the money screen that is typed rather than derived: the
 *  ceiling the couple and the producer agreed on. Blank clears it, so a
 *  target that was never real can be taken back. */
export async function setBudgetTarget(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const clientId = String(form.get('client_id') ?? '');
  const raw = String(form.get('budget_target') ?? '').trim();
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  let target: number | null = null;
  if (raw) {
    const n = parseIls(raw);
    if (n === null || n < 0) return { ok: false, error: 'תקציב היעד צריך להיות מספר' };
    /* Kept to the agora rather than rounded to the shekel. It was rounded
       here, which is defensible for a planning figure and indefensible once
       the field beside it accepts agorot: two money fields on one screen
       that treat a decimal point differently is the kind of inconsistency
       somebody spends an afternoon not believing. */
    target = n;
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('clients').update({ budget_target: target }).eq('id', clientId);
  if (error) {
    console.error('[money] target failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את תקציב היעד' };
  }
  touch(clientId);
  return { ok: true };
}
