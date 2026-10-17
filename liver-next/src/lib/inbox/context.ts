import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phone';

/**
 * Whose message this is.
 *
 * By the sender first, which is cheap and certain: a phone or an address
 * that is on an event's contact line, on a couple's sign-in list, on a
 * supplier's card or on an open lead. A sender known to one event is a
 * high match. A supplier is a match to the supplier, and to the event only
 * when they are on exactly one open event; a caterer who works three of
 * this producer's weddings is a medium match that the reading will have to
 * settle from the text.
 */

export type Match = {
  clientId: string | null;
  vendorId: string | null;
  leadId: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  /** The names the reading can choose between, when it has to. */
  candidates: { id: string; name: string; date: string | null; venue: string }[];
};

export type Sender = { phone?: string | null; email?: string | null };

const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a === b);

export async function resolveContext(sb: SupabaseClient, producerId: string, sender: Sender): Promise<Match> {
  const phone = normalizePhone(sender.phone ?? '');
  const email = String(sender.email ?? '').trim().toLowerCase() || null;

  const { data: clients } = await sb.from('clients')
    .select('id,display_name,event_date,venue,contact_phone,contact_email')
    .eq('producer_id', producerId).is('archived_at', null);
  const live = (clients ?? []) as { id: string; display_name: string; event_date: string | null; venue: string; contact_phone: string; contact_email: string }[];
  const candidates = live.map((c) => ({ id: c.id, name: c.display_name, date: c.event_date, venue: c.venue }));
  const none = (reason: string): Match => ({ clientId: null, vendorId: null, leadId: null, confidence: 'low', reason, candidates });

  if (!phone && !email) return none('בלי שולח');

  /* The event's own contact line. */
  const byContact = live.filter((c) => same(normalizePhone(c.contact_phone), phone) || same(c.contact_email.toLowerCase() || null, email));
  if (byContact.length === 1) {
    return { clientId: byContact[0].id, vendorId: null, leadId: null, confidence: 'high', reason: 'איש הקשר של האירוע', candidates };
  }

  /* The couple's sign-in addresses. */
  if (email) {
    const ids = live.map((c) => c.id);
    const { data: auth } = ids.length
      ? await sb.from('client_authorized_emails').select('client_id').eq('email', email).in('client_id', ids)
      : { data: [] };
    const hits = [...new Set((auth ?? []).map((a) => (a as { client_id: string }).client_id))];
    if (hits.length === 1) return { clientId: hits[0], vendorId: null, leadId: null, confidence: 'high', reason: 'כתובת של בני הזוג', candidates };
  }

  /* A supplier. */
  const { data: vendors } = await sb.from('vendors').select('id,name,phone,email').eq('producer_id', producerId).is('archived_at', null);
  const vendor = ((vendors ?? []) as { id: string; name: string; phone: string; email: string }[])
    .find((v) => same(normalizePhone(v.phone), phone) || same(v.email.toLowerCase() || null, email));
  if (vendor) {
    const { data: ev } = await sb.from('event_vendors').select('client_id').eq('vendor_id', vendor.id).in('client_id', live.map((c) => c.id));
    const on = [...new Set((ev ?? []).map((e) => (e as { client_id: string }).client_id))];
    if (on.length === 1) return { clientId: on[0], vendorId: vendor.id, leadId: null, confidence: 'high', reason: `ספק (${vendor.name}) על אירוע אחד`, candidates };
    return { clientId: null, vendorId: vendor.id, leadId: null, confidence: 'medium', reason: `ספק (${vendor.name}) על ${on.length} אירועים`, candidates };
  }

  /* An open lead. */
  const { data: leads } = await sb.from('leads').select('id,phone,email,status').eq('producer_id', producerId).neq('status', 'lost')
    .order('created_at', { ascending: false }).limit(300);
  const lead = ((leads ?? []) as { id: string; phone: string; email: string }[])
    .find((l) => same(normalizePhone(l.phone), phone) || same(l.email.toLowerCase() || null, email));
  if (lead) return { clientId: null, vendorId: null, leadId: lead.id, confidence: 'high', reason: 'ליד פתוח', candidates };

  if (byContact.length > 1) return { ...none('השולח על כמה אירועים'), confidence: 'medium' };
  return none('שולח לא מוכר');
}

/** What the reading needs to know about the event it is reading for. */
export async function eventFacts(sb: SupabaseClient, clientId: string): Promise<{
  name: string; date: string | null; venue: string; guests: number | null;
  budget: { id: string; category: string; label: string; estimate: number; agreed: number | null; vendor: string }[];
  vendors: { id: string; name: string; category: string; status: string }[];
  tasks: { id: string; title: string; due_on: string | null }[];
  payments: { id: string; title: string; amount: number; due_on: string | null; paid: boolean }[];
}> {
  const [{ data: c }, { data: b }, { data: v }, { data: t }, { data: p }] = await Promise.all([
    sb.from('clients').select('display_name,event_date,venue,guest_estimate').eq('id', clientId).maybeSingle(),
    sb.from('budget_items').select('id,category,label,estimate,agreed,vendor').eq('client_id', clientId).limit(200),
    sb.from('event_vendors').select('id,name,category,status').eq('client_id', clientId).limit(100),
    sb.from('tasks').select('id,title,due_on').eq('client_id', clientId).eq('done', false).limit(100),
    sb.from('payments').select('id,title,amount,due_on,paid').eq('client_id', clientId).limit(50),
  ]);
  const cl = c as { display_name?: string; event_date?: string | null; venue?: string; guest_estimate?: number | null } | null;
  return {
    name: cl?.display_name ?? '', date: cl?.event_date ?? null, venue: cl?.venue ?? '', guests: cl?.guest_estimate ?? null,
    budget: (b ?? []).map((r) => ({ ...(r as object), estimate: Number((r as { estimate: unknown }).estimate), agreed: (r as { agreed: unknown }).agreed === null ? null : Number((r as { agreed: unknown }).agreed) })) as never,
    vendors: (v ?? []) as never, tasks: (t ?? []) as never,
    payments: (p ?? []).map((r) => ({ ...(r as object), amount: Number((r as { amount: unknown }).amount) })) as never,
  };
}
