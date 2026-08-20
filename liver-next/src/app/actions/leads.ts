'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';

export type LeadActionResult = { ok: boolean; error?: string };

const STATUSES = ['new', 'contacted', 'meeting', 'won', 'lost'] as const;

function touch() {
  revalidatePath('/app/leads');
  revalidatePath('/app');
}

export async function setLeadStatus(form: FormData): Promise<void> {
  const id = String(form.get('lead_id') ?? '');
  const status = String(form.get('status') ?? '');
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const sb = await supabaseServer();
  await sb.from('leads').update({ status }).eq('id', id);
  touch();
}

export async function setLeadNote(form: FormData): Promise<void> {
  const id = String(form.get('lead_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('leads').update({ note: String(form.get('note') ?? '').slice(0, 500) }).eq('id', id);
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
  await sb.from('sales_calls').update({ done: !done }).eq('id', id);
  touch();
}

/** The point of a lead is to stop being one. Everything already gathered
 *  travels across, and the lead is marked won rather than deleted so the
 *  enquiry it came from is still on record. */
export async function convertLead(form: FormData): Promise<void> {
  const id = String(form.get('lead_id') ?? '');
  if (!id) return;

  const account = await currentAccount();
  if (!account?.producer) return;

  const sb = await supabaseServer();
  const { data: lead } = await sb
    .from('leads')
    .select('id,full_name,kind,event_date,guest_count')
    .eq('id', id)
    .maybeSingle();
  if (!lead) return;

  const { data: client, error } = await sb
    .from('clients')
    .insert({
      producer_id: account.producer.id,
      display_name: lead.full_name,
      kind: lead.kind,
      event_date: lead.event_date,
      guest_estimate: lead.guest_count,
    })
    .select('id')
    .single();
  if (error || !client) return;

  await sb.from('leads').update({ status: 'won' }).eq('id', id);
  touch();
  redirect(`/app/clients/${client.id}`);
}
