'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireAccount } from '@/lib/auth';
import { parseIls } from '@/lib/money';
import { whyNotSaved } from '@/lib/writeFailure';
import { BUDGET_STATUSES, PAYERS, METHODS, splitRemaining, seedLines, totals, type GridItem, type GridPayment } from '@/lib/budgetGrid';
import { BASE_SPLITS, PLAN_CATEGORIES, readPlan, type PlanCategory } from '@/lib/budgetPlan';
import { appCopy } from '@/content/site';

/**
 * The sheet's writes.
 *
 * One cell, one action: the grid moves first and calls `patchBudgetCell`
 * after a short pause, so every write here is small and says exactly
 * which column it touched. The allowlist is the whole of the safety: a
 * field name the sheet does not draw is refused, and the two figures the
 * producer locks (the plan once approved, the agreed price once booked)
 * are refused for the couple here rather than hidden on the screen,
 * because the screen is not the fence.
 *
 * Every write that matched no row says so. "Saved" over an unchanged
 * value is the one outcome worse than failing.
 */
export type CellResult = { ok: boolean; error?: string; id?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
}

const TEXT_FIELDS: Record<string, number> = { label: 120, vendor: 120, notes: 2000, category: 40 };
const MONEY_FIELDS = new Set(['estimate', 'quoted', 'agreed']);
const BOOL_FIELDS = new Set(['includes_vat', 'per_guest', 'visible_to_couple']);
const PRODUCER_ONLY = new Set(['visible_to_couple']);

type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

function parseField(field: string, raw: string): Parsed {
  if (field in TEXT_FIELDS) {
    const v = raw.trim().slice(0, TEXT_FIELDS[field]);
    if (field === 'label' && v.length < 1) return { ok: false, error: 'לסעיף צריך שם' };
    if (field === 'category' && v && !(PLAN_CATEGORIES as readonly string[]).includes(v)) return { ok: false, error: 'קטגוריה לא מוכרת' };
    return { ok: true, value: v };
  }
  if (MONEY_FIELDS.has(field)) {
    if (!raw.trim()) return field === 'estimate' ? { ok: true, value: 0 } : { ok: true, value: null };
    const n = parseIls(raw);
    if (n === null || n < 0) return { ok: false, error: 'זה לא סכום' };
    return { ok: true, value: n };
  }
  if (BOOL_FIELDS.has(field)) return { ok: true, value: raw === 'true' || raw === '1' };
  if (field === 'status') {
    if (!(BUDGET_STATUSES as readonly string[]).includes(raw)) return { ok: false, error: 'סטטוס לא מוכר' };
    return { ok: true, value: raw };
  }
  if (field === 'paid_by') {
    if (!(PAYERS as readonly string[]).includes(raw)) return { ok: false, error: 'מי משלם לא מוכר' };
    return { ok: true, value: raw };
  }
  if (field === 'vat_rate') {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 0.5) return { ok: false, error: 'שיעור מע"מ לא תקין' };
    return { ok: true, value: n };
  }
  if (field === 'guest_count_override') {
    if (!raw.trim()) return { ok: true, value: null };
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 5000) return { ok: false, error: 'מספר אורחים לא תקין' };
    return { ok: true, value: n };
  }
  if (field === 'due_date') {
    if (!raw.trim()) return { ok: true, value: null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: 'תאריך לא תקין' };
    return { ok: true, value: raw };
  }
  return { ok: false, error: 'שדה לא מוכר' };
}

async function producerOf(sb: Awaited<ReturnType<typeof supabaseServer>>, clientId: string): Promise<string | null> {
  const { data } = await sb.from('clients').select('producer_id').eq('id', clientId).maybeSingle();
  return (data as { producer_id?: string } | null)?.producer_id ?? null;
}

async function log(sb: Awaited<ReturnType<typeof supabaseServer>>, clientId: string, actor: 'producer' | 'couple', title: string, body: string, refId: string | null) {
  const producerId = await producerOf(sb, clientId);
  if (!producerId) return;
  await sb.from('activity_log').insert({
    producer_id: producerId, client_id: clientId, kind: 'budget_change', title: title.slice(0, 300), body: body.slice(0, 4000),
    ref_table: 'budget_items', ref_id: refId, actor,
  });
}

export async function patchBudgetCell(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const field = String(form.get('field') ?? '');
  const raw = String(form.get('value') ?? '');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };

  const account = await requireAccount();
  const couple = account.role === 'client';
  if (couple && PRODUCER_ONLY.has(field)) return { ok: false, error: 'רק המפיק משנה את זה' };

  const parsed = parseField(field, raw);
  if (!parsed.ok) return parsed;

  const sb = await supabaseServer();
  const { data: before } = await sb.from('budget_items')
    .select('label,status,estimate,agreed,quoted,vendor,notes,category').eq('id', id).maybeSingle();
  if (!before) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };

  if (couple) {
    /* The two locks. The plan is the baseline once approved; the agreed
       price is a signature once booked. Both are the producer's to move. */
    if (field === 'estimate') {
      const { data: c } = await sb.from('clients').select('budget_approved_at').eq('id', clientId).maybeSingle();
      if ((c as { budget_approved_at?: string | null } | null)?.budget_approved_at) return { ok: false, error: 'התוכנית אושרה, ורק המפיק משנה אותה' };
    }
    if (field === 'agreed' && (before.status === 'booked' || before.status === 'paid')) {
      return { ok: false, error: 'הסעיף סגור. לשינוי המחיר שסוכם דברו עם המפיק' };
    }
  }

  const patch: Record<string, unknown> = { [field]: parsed.value };
  /* A price agreed on a line still marked an idea is a booking, and a
     quote on one is a quote. The status follows the figure so a sheet
     filled by typing numbers reads right without a second pass. */
  if (field === 'agreed' && parsed.value !== null && before.status === 'idea') patch.status = 'booked';
  if (field === 'agreed' && parsed.value !== null && before.status === 'quoted') patch.status = 'booked';
  if (field === 'quoted' && parsed.value !== null && before.status === 'idea') patch.status = 'quoted';

  const { data, error } = await sb.from('budget_items').update(patch).eq('id', id).select('id');
  if (error) {
    console.error('[budget] patch failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  if (!data || data.length === 0) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };

  const was = String((before as Record<string, unknown>)[field] ?? '');
  const now = String(parsed.value ?? '');
  await log(sb, clientId, couple ? 'couple' : 'producer', `${before.label}: ${field}`, `${was} ⇒ ${now}`, id);
  touch(clientId);
  return { ok: true, id };
}

export async function addBudgetLine(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const clientId = String(form.get('client_id') ?? '');
  const category = String(form.get('category') ?? '').trim();
  const label = String(form.get('label') ?? '').trim().slice(0, 120);
  const estimate = parseIls(String(form.get('estimate') ?? '')) ?? 0;
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (category && !(PLAN_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'קטגוריה לא מוכרת' };

  const sb = await supabaseServer();
  const { data: last } = await sb.from('budget_items').select('sort_order').eq('client_id', clientId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort = ((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1;
  const { data, error } = await sb.from('budget_items')
    .insert({ client_id: clientId, category, label: label || appCopy.money.grid.newLine, estimate: Math.max(0, estimate), sort_order: sort, source: 'manual' })
    .select('id').single();
  if (error) {
    console.error('[budget] add failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  touch(clientId);
  return { ok: true, id: data.id };
}

/** A soft delete: the line goes to `cancelled` and keeps its payments, so
 *  "never mind" ten seconds later is `restoreBudgetLine` and not retyping. */
export async function cancelBudgetLine(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('budget_items').update({ status: 'cancelled' }).eq('id', id).select('id,label');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  const account = await requireAccount();
  await log(sb, clientId, account.role === 'client' ? 'couple' : 'producer', `${data[0].label}: ${appCopy.money.grid.cancelled}`, '', id);
  touch(clientId);
  return { ok: true, id };
}

export async function restoreBudgetLine(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const status = String(form.get('status') ?? 'idea');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };
  if (!(BUDGET_STATUSES as readonly string[]).includes(status) || status === 'cancelled') return { ok: false, error: 'סטטוס לא מוכר' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('budget_items').update({ status }).eq('id', id).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  touch(clientId);
  return { ok: true, id };
}

/** The order of one area after a drag: the ids in their new order, each
 *  written with the area it landed in, so a line dragged across areas
 *  changes category in the same write. */
export async function reorderBudgetLines(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const clientId = String(form.get('client_id') ?? '');
  const category = String(form.get('category') ?? '').trim();
  const ids = String(form.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (!clientId || ids.length === 0) return { ok: false, error: 'אין מה לסדר' };
  if (category && !(PLAN_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'קטגוריה לא מוכרת' };
  const sb = await supabaseServer();
  for (let k = 0; k < ids.length; k++) {
    const { error } = await sb.from('budget_items').update({ sort_order: k + 1, category }).eq('id', ids[k]).eq('client_id', clientId);
    if (error) return { ok: false, error: whyNotSaved(error) };
  }
  touch(clientId);
  return { ok: true };
}

/** The producer's note on a line. Upserted into the private table, which
 *  the couple has no policy on, so it can never reach their screen. */
export async function saveInternalNote(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const text = String(form.get('internal_notes') ?? '').trim().slice(0, 4000);
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };
  const sb = await supabaseServer();
  const { error } = await sb.from('budget_item_private').upsert({ item_id: id, internal_notes: text }, { onConflict: 'item_id' });
  if (error) return { ok: false, error: whyNotSaved(error) };
  touch(clientId);
  return { ok: true, id };
}

/* ── payments against a line ─────────────────────────────────────────────── */

function paymentFields(form: FormData): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const amount = parseIls(String(form.get('amount') ?? ''));
  if (amount === null || amount <= 0) return { ok: false, error: 'הסכום צריך להיות גדול מאפס' };
  const dueAt = String(form.get('due_at') ?? '').trim();
  const paidAt = String(form.get('paid_at') ?? '').trim();
  const method = String(form.get('method') ?? '').trim();
  if (!(METHODS as readonly string[]).includes(method)) return { ok: false, error: 'אמצעי תשלום לא מוכר' };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (dueAt && !iso.test(dueAt)) return { ok: false, error: 'תאריך יעד לא תקין' };
  if (paidAt && !iso.test(paidAt)) return { ok: false, error: 'תאריך תשלום לא תקין' };
  return { ok: true, row: {
    amount, due_at: dueAt || null, paid_at: paidAt || null, method,
    paid_by: String(form.get('paid_by') ?? '').trim().slice(0, 20),
    reference: String(form.get('reference') ?? '').trim().slice(0, 80),
    notes: String(form.get('notes') ?? '').trim().slice(0, 2000),
  } };
}

export async function addBudgetPayment(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const itemId = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!itemId || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };
  const f = paymentFields(form);
  if (!f.ok) return f;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('budget_payments').insert({ item_id: itemId, client_id: clientId, ...f.row }).select('id').single();
  if (error) return { ok: false, error: whyNotSaved(error) };
  touch(clientId);
  return { ok: true, id: data.id };
}

export async function updateBudgetPayment(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה תשלום' };
  const f = paymentFields(form);
  if (!f.ok) return f;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('budget_payments').update(f.row).eq('id', id).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  touch(clientId);
  return { ok: true, id };
}

/** Paid today, or not paid at all. The date can be corrected afterwards
 *  through `updateBudgetPayment`; this is the one press. */
export async function setBudgetPaymentPaid(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const paid = String(form.get('paid') ?? '') === 'true';
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה תשלום' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('budget_payments')
    .update({ paid_at: paid ? new Date().toISOString().slice(0, 10) : null }).eq('id', id).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  touch(clientId);
  return { ok: true, id };
}

export async function deleteBudgetPayment(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const id = String(form.get('payment_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה תשלום' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('budget_payments').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  touch(clientId);
  return { ok: true, id };
}

/** What is left on a line as N equal payments a month apart. */
export async function splitBudgetPayments(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const itemId = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const n = Math.floor(Number(form.get('count') ?? 0));
  const remaining = parseIls(String(form.get('remaining') ?? ''));
  if (!itemId || !clientId) return { ok: false, error: 'חסר מזהה סעיף' };
  if (!Number.isFinite(n) || n < 2 || n > 24) return { ok: false, error: 'בין שניים לעשרים וארבעה תשלומים' };
  if (remaining === null || remaining <= 0) return { ok: false, error: 'אין יתרה לפצל' };
  const parts = splitRemaining(remaining, n, new Date().toISOString().slice(0, 10));
  const sb = await supabaseServer();
  const { error } = await sb.from('budget_payments').insert(parts.map((p) => ({ item_id: itemId, client_id: clientId, ...p })));
  if (error) return { ok: false, error: whyNotSaved(error) };
  touch(clientId);
  return { ok: true };
}

/* ── the approved baseline ───────────────────────────────────────────────── */

export async function askBudgetApproval(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('clients').update({ budget_approval_asked_at: new Date().toISOString() }).eq('id', clientId).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  touch(clientId);
  return { ok: true };
}

/** The couple's yes. The plan locks and the three totals are kept, so
 *  every overrun from here is measured against the figure they agreed. */
export async function approveBudget(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const sb = await supabaseServer();
  const [{ data: items }, { data: payments }, { data: client }] = await Promise.all([
    sb.from('budget_items').select('*').eq('client_id', clientId),
    sb.from('budget_payments').select('*').eq('client_id', clientId),
    sb.from('clients').select('guest_estimate,budget_target').eq('id', clientId).maybeSingle(),
  ]);
  const c = client as { guest_estimate: number | null; budget_target: number | string | null } | null;
  const t = totals((items ?? []) as GridItem[], (payments ?? []) as GridPayment[], c?.guest_estimate ?? null,
    c?.budget_target === null || c?.budget_target === undefined ? null : Number(c.budget_target));
  const { data, error } = await sb.from('clients').update({ budget_approved_at: new Date().toISOString() }).eq('id', clientId).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  await sb.from('budget_snapshots').insert({ client_id: clientId, total_planned: t.planned, total_agreed: t.agreed, total_paid: t.paid, reason: 'approved' });
  touch(clientId);
  return { ok: true };
}

/** A sheet with figures on it rather than a blank one: one planned line
 *  per area from the plan's own split, or the baseline split when no plan
 *  was built, times the target. Refused when lines already exist, because
 *  a seed over a real budget is a second budget. */
export async function seedBudget(_prev: CellResult | null, form: FormData): Promise<CellResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const sb = await supabaseServer();
  const { count } = await sb.from('budget_items').select('id', { count: 'exact', head: true }).eq('client_id', clientId);
  if ((count ?? 0) > 0) return { ok: false, error: 'כבר יש סעיפים בתקציב' };
  const { data: client } = await sb.from('clients').select('budget_target,budget_plan').eq('id', clientId).maybeSingle();
  const c = client as { budget_target: number | string | null; budget_plan: unknown } | null;
  const plan = readPlan(c?.budget_plan);
  const total = plan?.total ?? (c?.budget_target === null || c?.budget_target === undefined ? 0 : Number(c.budget_target));
  if (!total || total <= 0) return { ok: false, error: 'קודם צריך תקציב יעד' };
  const splits = plan?.splits ?? BASE_SPLITS;
  const labels = appCopy.money.plan.categories as Record<PlanCategory, string>;
  const lines = seedLines(total, splits, labels).map((l, k) => ({ client_id: clientId, ...l, sort_order: k + 1, source: 'calculator' }));
  /* What the questionnaire says this wedding needs that the split does not
     name: lines with a rough planned figure each, to be corrected, which is
     better than a line that is not there. The checklist adds the same four
     steps by the same answers. */
  const { data: profile } = await sb.from('couple_profiles')
    .select('kosher_level,children,afterparty,venue_type').eq('client_id', clientId).maybeSingle();
  const p = profile as { kosher_level?: string; children?: number | null; afterparty?: boolean; venue_type?: string } | null;
  const g = appCopy.money.grid;
  const extras: { category: PlanCategory; label: string; estimate: number }[] = [];
  if (p?.kosher_level === 'mehadrin' || p?.kosher_level === 'badatz') extras.push({ category: 'venue', label: g.seedKashrut, estimate: 4000 });
  if ((p?.children ?? 0) > 0) extras.push({ category: 'other', label: g.seedKids, estimate: 2500 });
  if (p?.afterparty) extras.push({ category: 'other', label: g.seedAfter, estimate: 8000 });
  if (p?.venue_type === 'beach' || p?.venue_type === 'home') extras.push({ category: 'venue', label: g.seedOutdoor, estimate: 15000 });
  extras.forEach((e, k) => lines.push({ client_id: clientId, ...e, sort_order: lines.length + k + 1, source: 'calculator' }));
  const { error } = await sb.from('budget_items').insert(lines);
  if (error) return { ok: false, error: whyNotSaved(error) };
  touch(clientId);
  return { ok: true };
}
