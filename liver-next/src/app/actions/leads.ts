'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';

export type LeadActionResult = { ok: boolean; error?: string };

const STATUSES = ['new', 'contacted', 'meeting', 'proposal_sent', 'won', 'lost', 'nurture'] as const;

function touch() {
  revalidatePath('/app/leads');
  revalidatePath('/app');
}

/** A lead somebody took down on the phone.
 *
 *  The write goes through record_lead(), which attributes the enquiry to the
 *  producer who is signed in rather than to whoever the public site belongs
 *  to. That distinction is the whole reason this is not a plain insert: the
 *  attribution trigger fills producer_id from the site's owner when it is
 *  left null, so a second producer typing a lead here would have watched it
 *  land in the root account's list and vanish from their own.
 *
 *  Everything a producer would have on a phone call is optional except a name
 *  and one way to answer. Asking for more than that, from somebody who is
 *  holding a phone, means the lead gets written on paper instead. */
export async function recordLead(_prev: LeadActionResult | null, form: FormData): Promise<LeadActionResult> {
  const v = (k: string) => String(form.get(k) ?? '').trim();

  const name = v('full_name');
  const phone = v('phone');
  const email = v('email').toLowerCase();

  if (name.length < 2) return { ok: false, error: 'נא למלא שם' };
  if (!phone && !email) return { ok: false, error: 'צריך טלפון או אימייל' };

  const guests = Number(v('guest_count'));

  const sb = await supabaseServer();
  const { error } = await sb.rpc('record_lead', {
    p_full_name: name,
    p_phone: phone,
    p_email: email,
    p_kind: v('kind') === 'corporate' ? 'corporate' : 'wedding',
    p_event_date: v('event_date') || null,
    p_guest_count: Number.isFinite(guests) && guests > 0 ? Math.min(guests, 1500) : null,
    p_message: v('message'),
    p_source: v('source') || 'phone',
    p_location: v('location').slice(0, 120),
  });

  if (error) {
    console.error('[leads] record failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור את הפנייה' };
  }

  touch();
  return { ok: true };
}

export async function setLeadStatus(form: FormData): Promise<void> {
  const id = String(form.get('lead_id') ?? '');
  const status = String(form.get('status') ?? '');
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('leads').update({ status }).eq('id', id);
  if (error) {
    console.error('[leads] setLeadStatus failed', error);
    await noteFailure('לא הצלחנו לעדכן. אפשר לנסות שוב.');
  }
  touch();
}

export async function setLeadNote(form: FormData): Promise<void> {
  const id = String(form.get('lead_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('leads').update({ note: String(form.get('note') ?? '').slice(0, 500) }).eq('id', id);
  if (error) {
    console.error('[leads] setLeadNote failed', error);
    await noteFailure('לא הצלחנו לעדכן. אפשר לנסות שוב.');
  }
  touch();
}

/** Booking the follow up from the lead means the workspace is implied rather
 *  than typed. The database refuses a call against a lead in another
 *  workspace, so a mismatch is a refusal, not a silently misfiled call. */
export async function bookCall(_prev: LeadActionResult | null, form: FormData): Promise<LeadActionResult> {
  const leadId = String(form.get('lead_id') ?? '');
  const title = String(form.get('title') ?? '').trim() || 'שיחת המשך';
  const remindOn = String(form.get('remind_on') ?? '').trim();

  if (!leadId) return { ok: false, error: 'חסר מזהה ליד' };
  if (!remindOn) return { ok: false, error: 'נא לבחור תאריך לתזכורת' };

  const sb = await supabaseServer();
  const { error } = await sb.from('sales_calls').insert({
    lead_id: leadId,
    title,
    phone: String(form.get('phone') ?? '').trim(),
    remind_on: remindOn,
    notes: String(form.get('notes') ?? '').trim(),
  });
  if (error) return { ok: false, error: 'לא הצלחנו לקבוע את השיחה' };

  touch();
  return { ok: true };
}

export async function completeCall(form: FormData): Promise<void> {
  const id = String(form.get('call_id') ?? '');
  const done = String(form.get('done') ?? '') === 'true';
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('sales_calls').update({ done: !done }).eq('id', id);
  if (error) {
    console.error('[leads] completeCall failed', error);
    await noteFailure('לא הצלחנו לעדכן. אפשר לנסות שוב.');
  }
  touch();
}

/**
 * The point of a lead is to stop being one.
 *
 * This used to claim, in a comment directly above it, that everything already
 * gathered travelled across. It did not, and had not for as long as the
 * function existed: the name, the kind, the date, the guest count and the
 * location came over, and the phone number, the address, what the couple
 * wrote and where they came from were left behind on a screen the producer
 * had just finished with. The cost is small and constant — convert an
 * enquiry, then go back to the leads list to find the phone number of the
 * couple whose event you are now standing in.
 *
 * The lead is marked won rather than deleted, and the event now keeps a
 * reference to it. That reference is the part worth having: it is the only
 * way to answer how many enquiries became events, from which source, and how
 * long it took, and it keeps the call history reachable from the file.
 */
export async function convertLead(form: FormData): Promise<void> {
  const id = String(form.get('lead_id') ?? '');
  if (!id) return;

  const account = await currentAccount();
  if (!account?.producer) return;

  const sb = await supabaseServer();
  const { data: lead } = await sb
    .from('leads')
    .select('id,full_name,kind,event_date,guest_count,location,email,phone,message,note,source')
    .eq('id', id)
    .maybeSingle();
  if (!lead) return;

  /* Converting the same enquiry twice is a double entry in the events list
     with the same couple in it, and the second one has no history. It happens
     with a slow connection and a second press. */
  const { data: already } = await sb
    .from('clients')
    .select('id')
    .eq('lead_id', id)
    .maybeSingle();
  if (already) {
    touch();
    redirect(`/app/clients/${already.id}`);
  }

  /* What the couple wrote and what the producer wrote about them are two
     different things and both are worth keeping, so they are joined rather
     than one overwriting the other. */
  const brief = [lead.message, lead.note].map((v) => String(v ?? '').trim()).filter(Boolean).join('\n\n');

  const { data: client, error } = await sb
    .from('clients')
    .insert({
      producer_id: account.producer.id,
      display_name: lead.full_name,
      kind: lead.kind,
      event_date: lead.event_date,
      guest_estimate: lead.guest_count,
      /* Where the event is. A region rather than a venue is still worth more
         on the file than an empty field, and the producer overwrites it with
         the hall the day one is booked. */
      venue: lead.location || null,
      contact_email: lead.email || '',
      contact_phone: lead.phone || '',
      brief,
      source: lead.source || '',
      lead_id: lead.id,
    })
    .select('id')
    .single();
  if (error || !client) return;

  await sb.from('leads').update({ status: 'won' }).eq('id', id);
  touch();
  redirect(`/app/clients/${client.id}`);
}

/* ── the card ──────────────────────────────────────────────────────────── */

/** The fields the card's form carries, and never the status: that is the
 *  column it sits in, moved by its own control. Blank clears a value on
 *  purpose, because a date somebody typed wrong has to be removable. */
export async function updateLead(_prev: LeadActionResult | null, form: FormData): Promise<LeadActionResult> {
  const id = String(form.get('lead_id') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה ליד' };
  const v = (k: string) => String(form.get(k) ?? '').trim();
  const num = (k: string, lo: number, hi: number): number | null => {
    const raw = v(k);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
  };
  const name = v('full_name');
  if (name.length < 2) return { ok: false, error: 'נא למלא שם' };
  const email = v('email').toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'האימייל לא תקין' };
  const date = v('event_date');
  if (date && Number.isNaN(Date.parse(date))) return { ok: false, error: 'התאריך לא תקין' };

  const sb = await supabaseServer();
  const { data, error } = await sb.from('leads').update({
    full_name: name.slice(0, 120),
    partner_name: v('partner_name').slice(0, 120),
    phone: v('phone').slice(0, 40),
    email: email.slice(0, 160),
    instagram_handle: v('instagram_handle').replace(/^@/, '').slice(0, 80),
    event_date: date || null,
    event_date_flexible: v('event_date_flexible') === 'on',
    guest_count: num('guest_count', 1, 1500),
    location: v('location').slice(0, 120),
    budget_min: num('budget_min', 0, 10_000_000),
    budget_max: num('budget_max', 0, 10_000_000),
    venue_booked: v('venue_booked') === 'on',
    lost_reason: v('lost_reason').slice(0, 300),
  }).eq('id', id).select('id');
  if (error) {
    console.error('[leads] updateLead failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }
  if (!data?.length) return { ok: false, error: 'הליד לא נמצא' };
  touch();
  revalidatePath(`/app/leads/${id}`);
  return { ok: true };
}

export async function setNextAction(_prev: LeadActionResult | null, form: FormData): Promise<LeadActionResult> {
  const id = String(form.get('lead_id') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה ליד' };
  const what = String(form.get('next_action') ?? '').trim().slice(0, 300);
  const when = String(form.get('next_action_at') ?? '').trim();
  if (what && !when) return { ok: false, error: 'מתי?' };
  const at = when ? new Date(when) : null;
  if (at && Number.isNaN(at.getTime())) return { ok: false, error: 'התאריך לא תקין' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('leads')
    .update({ next_action: what, next_action_at: what && at ? at.toISOString() : null })
    .eq('id', id).select('id');
  if (error) {
    console.error('[leads] setNextAction failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }
  if (!data?.length) return { ok: false, error: 'הליד לא נמצא' };
  touch();
  revalidatePath(`/app/leads/${id}`);
  return { ok: true };
}

/** Something happened that only the producer knows about: a note, or a
 *  message that went out through WhatsApp from the button on the card. A
 *  message out also stamps the first response, by trigger. */
export async function addLeadEvent(_prev: LeadActionResult | null, form: FormData): Promise<LeadActionResult> {
  const id = String(form.get('lead_id') ?? '');
  const type = String(form.get('type') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה ליד' };
  if (!['note', 'message_out', 'call'].includes(type)) return { ok: false, error: 'סוג לא מוכר' };
  const body = String(form.get('body') ?? '').trim().slice(0, 8000);
  if (type === 'note' && !body) return { ok: false, error: 'הערה ריקה' };
  const account = await currentAccount();
  const sb = await supabaseServer();
  const { error } = await sb.from('lead_events').insert({
    lead_id: id, type, channel: String(form.get('channel') ?? '').slice(0, 40), body,
    created_by: account?.id ?? null,
  });
  if (error) {
    console.error('[leads] addLeadEvent failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }
  touch();
  revalidatePath(`/app/leads/${id}`);
  return { ok: true };
}

/** Three fields, from a phone that is still ringing. Everything else is
 *  the card's to fill in later. */
export async function quickLead(_prev: LeadActionResult | null, form: FormData): Promise<LeadActionResult> {
  const v = (k: string) => String(form.get(k) ?? '').trim();
  const name = v('full_name');
  const phone = v('phone');
  if (name.length < 2) return { ok: false, error: 'נא למלא שם' };
  if (!phone) return { ok: false, error: 'צריך טלפון' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('record_lead', {
    p_full_name: name,
    p_phone: phone,
    p_email: '',
    p_kind: 'wedding',
    p_event_date: null,
    p_guest_count: null,
    p_message: v('note'),
    p_source: v('source') || 'phone',
    p_location: '',
  });
  if (error) {
    console.error('[leads] quickLead failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור את הפנייה' };
  }
  touch();
  if (typeof data === 'string' && data) redirect(`/app/leads/${data}`);
  return { ok: true };
}
