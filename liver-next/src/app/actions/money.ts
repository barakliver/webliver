'use server';

import { whyNotSaved } from '@/lib/writeFailure';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { noteFailure } from '@/lib/flash';
import { parseIls } from '@/lib/money';
import { todayInZone } from '@/lib/clock';
import { PAY_METHODS } from '@/lib/payMethods';

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

/** How a payment was made, from the closed set the cash-flow screen groups
 *  by. Anything else is "not said" rather than an error: the field is a
 *  convenience, and refusing a whole payment over it would be the wrong
 *  trade. */
const methodOf = (raw: FormDataEntryValue | null): string => {
  const m = String(raw ?? '').trim();
  return (PAY_METHODS as readonly string[]).includes(m) ? m : '';
};

/** Who paid: a name as typed, or the word for joint. Free text, trimmed and
 *  cut to the column's length, because the couple's names are typed by hand
 *  and a closed set would refuse the row the day one was corrected. */
const payerOf = (raw: FormDataEntryValue | null): string => String(raw ?? '').trim().slice(0, 60);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

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
    method: methodOf(form.get('method')),
  });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את התשלום' };

  touch(clientId);
  return { ok: true };
}

/**
 * Correcting a payment, which until now meant deleting it.
 *
 * A date slips and an amount is renegotiated, and on an event booked nine
 * months out both happen more than once. There was no update, so the only
 * way to change either was `deletePayment` and type it again — and the row
 * carries `paid` and `paid_on`, so correcting the date of a payment that had
 * already been made deleted the record that it was made.
 *
 * That is worse than the budget line this mirrors. A budget line is a plan;
 * a settled payment is money that moved, and a product that asks somebody to
 * delete the record of money moving in order to fix a typo in its date is
 * asking them to choose between a wrong book and a shorter one.
 *
 * So the title, the amount and the date are editable and the settlement is
 * not touched. `togglePaid` is the other act, and it is deliberately still
 * the only thing that writes `paid`: changing what a payment says and saying
 * it arrived are two different sentences, and one of them is the producer's
 * alone.
 */
export async function updatePayment(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const amount = amountOf(String(form.get('amount') ?? ''));
  const dueOn = String(form.get('due_on') ?? '').trim();
  const paidOn = String(form.get('paid_on') ?? '').trim();

  if (!id || !clientId) return { ok: false, error: 'חסר מזהה תשלום' };
  if (title.length < 2) return { ok: false, error: 'נא לכתוב על מה התשלום' };
  if (amount === null) return { ok: false, error: 'הסכום צריך להיות גדול מאפס' };

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('payments')
    /* `paid` is absent from this object on purpose, and so is `paid_on`: the
       day it was paid is written below, and only on a row that is paid. */
    .update({
      title, amount, due_on: dueOn || null,
      method: methodOf(form.get('method')),
      paid_by: payerOf(form.get('paid_by')),
    })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[money] updatePayment failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  if (!data || data.length === 0) {
    /* Not a fault: the row is gone, and in practice it was deleted in
       another tab. The classifier has the sentence for that, so this hands
       it the code PostgREST uses for "no rows where one was expected"
       rather than inventing a second way of saying it. */
    return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  }

  /* The day it was paid, corrected. Guarded by `paid = true` in the query
     itself, because the table refuses a paid_on on an unpaid row and a form
     is not allowed to be the thing that decides which kind of row this is. A
     blank is left alone: a settled payment always has a day. */
  if (ISO_DAY.test(paidOn)) {
    const { error: dayError } = await sb.from('payments').update({ paid_on: paidOn }).eq('id', id).eq('paid', true);
    if (dayError) {
      console.error('[money] updatePayment paid_on failed', dayError);
      return { ok: false, error: whyNotSaved(dayError) };
    }
  }

  touch(clientId);
  return { ok: true };
}

/**
 * Marking a payment settled, and saying how.
 *
 * The press used to be one button that flipped a flag and let the database
 * write today's date, which is the whole of what it could say: that it was
 * paid. A producer asked "by whom, and when, and how" had nowhere to put the
 * answer. So settling is a small form of its own - the day, who of the two,
 * and the method - and the day is the one the money moved, which is often not
 * the day somebody got round to recording it.
 *
 * Only this and `togglePaid` write `paid`; editing what a payment says
 * stays a different act, in `updatePayment`.
 */
export async function settlePayment(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const paidOn = String(form.get('paid_on') ?? '').trim();

  if (!id || !clientId) return { ok: false, error: 'חסר מזהה תשלום' };

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('payments')
    .update({
      paid: true,
      paid_on: ISO_DAY.test(paidOn) ? paidOn : todayInZone(),
      paid_by: payerOf(form.get('paid_by')),
      method: methodOf(form.get('method')),
    })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[money] settlePayment failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  if (!data || data.length === 0) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };

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

/**
 * Correcting a line that already exists.
 *
 * This was missing, and its absence is the whole reason the budget was hard
 * to keep. A line is born as a guess and becomes a fact: you write 40,000 for
 * the hall in March, you sign for 37,400 in June, and until now the only way
 * to record June was to delete the line and type all four fields again. So
 * either the budget stopped being true, or somebody retyped a supplier's name
 * from memory. Both happened.
 *
 * The agreed figure is the one this exists for, and it is the one that always
 * arrives late, but everything is editable for the same reason: a budget you
 * cannot correct is a budget that is wrong and knows it.
 *
 * `category` is accepted blank on purpose. Blank means "work it out from the
 * label", which is what `categoryOf` has always done and gets right most of
 * the time; typing one is how somebody overrules it when the hall is called
 * "אצל דודה" and no regular expression on earth is going to guess that.
 *
 * There is no ownership check here and none is wanted: the policy on
 * `budget_items` is the check, so an id belonging to somebody else's wedding
 * updates nothing and reports that it did nothing.
 */
export async function updateBudgetItem(_prev: MoneyResult | null, form: FormData): Promise<MoneyResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const label = String(form.get('label') ?? '').trim();
  const estimate = parseIls(form.get('estimate') as string | null);
  const agreedRaw = String(form.get('agreed') ?? '').trim();

  if (!id || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };
  if (label.length < 2) return { ok: false, error: 'נא לכתוב על מה הסעיף' };
  if (estimate === null || estimate < 0) return { ok: false, error: 'אומדן לא תקין' };

  /* Blank clears the agreed figure rather than leaving the old one, because
     a price can be un-agreed: a supplier falls through and the line goes back
     to being an estimate. Keeping the stale number would be the budget
     quietly insisting on a booking that is off. */
  const agreed = agreedRaw ? parseIls(agreedRaw) : null;
  if (agreedRaw && (agreed === null || agreed < 0)) {
    return { ok: false, error: 'סכום שנסגר לא תקין' };
  }

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('budget_items')
    .update({
      label, estimate, agreed,
      category: String(form.get('category') ?? '').trim(),
      vendor: String(form.get('vendor') ?? '').trim(),
    })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[money] updateBudgetItem failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  /* An update that matched nothing is not a success. Without this the screen
     says "saved" and shows the old figure, which is the worst of the three
     possible outcomes. */
  if (!data || data.length === 0) {
    /* Not a fault: the row is gone, and in practice it was deleted in
       another tab. The classifier has the sentence for that, so this hands
       it the code PostgREST uses for "no rows where one was expected"
       rather than inventing a second way of saying it. */
    return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  }

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
