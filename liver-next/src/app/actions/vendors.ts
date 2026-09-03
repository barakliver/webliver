'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { VENDOR_STATES, type VendorState } from '@/content/production';

export type VendorResult = { ok: boolean; error?: string; id?: string };

const KNOWN_STATES = new Set(VENDOR_STATES.map((s) => s.value as string));

function touchDirectory() {
  revalidatePath('/app/vendors');
}

function touchEvent(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
}

/* ── the producer's directory ───────────────────────────────────────────── */

/** A shekel figure from a form field: blank is null, anything that is not a
 *  non-negative number is null too, rather than a refusal over a stray comma. */
function money(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').replace(/[^\d.]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function directoryFields(form: FormData) {
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 2) return 'נא למלא שם ספק';
  return {
    agreed_price: money(form.get('agreed_price')),
    deposit_paid: money(form.get('deposit_paid')),
    name: name.slice(0, 120),
    category: String(form.get('category') ?? '').trim().slice(0, 40),
    contact_name: String(form.get('contact_name') ?? '').trim().slice(0, 120),
    phone: String(form.get('phone') ?? '').trim().slice(0, 40),
    email: String(form.get('email') ?? '').trim().toLowerCase().slice(0, 160),
    area: String(form.get('area') ?? '').trim().slice(0, 80),
    notes: String(form.get('notes') ?? '').trim().slice(0, 1000),
  };
}

export async function addVendor(_prev: VendorResult | null, form: FormData): Promise<VendorResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'אין מרחב הפקה משויך לחשבון' };

  const f = directoryFields(form);
  if (typeof f === 'string') return { ok: false, error: f };

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('vendors')
    .insert({ producer_id: account.producer.id, ...f })
    .select('id')
    .single();

  if (error) {
    console.error('[vendors] insert failed', error);
    /* The unique index is the point of the directory, so its refusal gets a
       sentence rather than the generic one: two rows for the same florist mean
       two phone numbers, and the wrong one is always the one that gets used. */
    if (/vendors_producer_name_key|duplicate key/i.test(error.message)) {
      return { ok: false, error: 'ספק בשם הזה כבר קיים אצלכם' };
    }
    return { ok: false, error: 'לא הצלחנו לשמור את הספק' };
  }

  touchDirectory();
  return { ok: true, id: data.id };
}

export async function updateVendor(_prev: VendorResult | null, form: FormData): Promise<VendorResult> {
  const id = String(form.get('vendor_id') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה ספק' };

  const f = directoryFields(form);
  if (typeof f === 'string') return { ok: false, error: f };

  const sb = await supabaseServer();
  const { error } = await sb.from('vendors').update(f).eq('id', id);
  if (error) {
    console.error('[vendors] update failed', error);
    if (/vendors_producer_name_key|duplicate key/i.test(error.message)) {
      return { ok: false, error: 'ספק בשם הזה כבר קיים אצלכם' };
    }
    return { ok: false, error: 'לא הצלחנו לשמור את השינוי' };
  }
  touchDirectory();
  return { ok: true, id };
}

/** Retired rather than deleted, and reversible. A supplier who is no longer
 *  used still appears on last year's events, and deleting the row would blank
 *  the supplier on a finished file rather than tidy anything. */
export async function setVendorArchived(form: FormData): Promise<void> {
  const id = String(form.get('vendor_id') ?? '');
  const archived = String(form.get('archived') ?? '') === 'true';
  if (!id) return;

  const sb = await supabaseServer();
  await sb.from('vendors').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  touchDirectory();
}

/* ── a supplier on one event ────────────────────────────────────────────── */

/** Booking from the directory goes through the database function, so the
 *  snapshot of name, category and phone is taken the same way from every
 *  screen that ever books one, and booking the same florist twice answers with
 *  the card that already exists. */
export async function bookVendor(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const vendorId = String(form.get('vendor_id') ?? '');
  if (!clientId || !vendorId) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('book_vendor', { p_client: clientId, p_vendor: vendorId });
  if (error) console.error('[vendors] book failed', error);
  touchEvent(clientId);
}

/** A one-off supplier, typed straight onto the event. Half of them are booked
 *  once and never again, and forcing every one into the directory first is the
 *  step that makes somebody write it on paper instead. */
export async function addEventVendor(_prev: VendorResult | null, form: FormData): Promise<VendorResult> {
  const clientId = String(form.get('client_id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (name.length < 2) return { ok: false, error: 'נא למלא שם ספק' };

  const time = String(form.get('call_time') ?? '').trim();
  const statusRaw = String(form.get('status') ?? 'shortlist');

  const sb = await supabaseServer();
  const { error } = await sb.from('event_vendors').insert({
    client_id: clientId,
    name: name.slice(0, 120),
    category: String(form.get('category') ?? '').trim().slice(0, 40),
    phone: String(form.get('phone') ?? '').trim().slice(0, 40),
    status: (KNOWN_STATES.has(statusRaw) ? statusRaw : 'shortlist') as VendorState,
    call_time: /^\d{2}:\d{2}$/.test(time) ? time : null,
    notes: String(form.get('notes') ?? '').trim().slice(0, 500),
  });

  if (error) {
    console.error('[vendors] event insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את הספק' };
  }
  touchEvent(clientId);
  return { ok: true };
}

export async function setEventVendorStatus(form: FormData): Promise<void> {
  const id = String(form.get('event_vendor_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const status = String(form.get('status') ?? '');
  if (!id || !KNOWN_STATES.has(status)) return;

  const sb = await supabaseServer();
  await sb.from('event_vendors').update({ status }).eq('id', id);
  touchEvent(clientId);
}

export async function removeEventVendor(form: FormData): Promise<void> {
  const id = String(form.get('event_vendor_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('event_vendors').delete().eq('id', id);
  touchEvent(clientId);
}

/** Filing a one-off supplier into the directory, so next August they are
 *  already there. The event card keeps its own copy either way. */
export async function promoteToDirectory(form: FormData): Promise<void> {
  const id = String(form.get('event_vendor_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const account = await currentAccount();
  if (!account?.producer) return;

  const sb = await supabaseServer();
  const { data: row } = await sb
    .from('event_vendors')
    .select('id,name,category,phone,vendor_id')
    .eq('id', id)
    .maybeSingle();
  if (!row || row.vendor_id) return;

  const { data: created, error } = await sb
    .from('vendors')
    .insert({
      producer_id: account.producer.id,
      name: row.name, category: row.category, phone: row.phone,
    })
    .select('id')
    .single();

  /* Already in the directory under that name: link to the existing entry
     rather than refusing, which is what the producer meant either way. */
  if (error) {
    const { data: existing } = await sb
      .from('vendors')
      .select('id')
      .eq('producer_id', account.producer.id)
      .ilike('name', row.name)
      .maybeSingle();
    if (existing) await sb.from('event_vendors').update({ vendor_id: existing.id }).eq('id', id);
  } else if (created) {
    await sb.from('event_vendors').update({ vendor_id: created.id }).eq('id', id);
  }

  touchEvent(clientId);
  touchDirectory();
}
