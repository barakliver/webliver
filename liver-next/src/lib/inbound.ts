import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveContext } from '@/lib/inbox/context';
import { receiveInbox, processInbox, type Attachment } from '@/lib/inbox/intake';
import { intakeLead } from '@/lib/leadIntake';
import { alertLead, type AlertLead } from '@/lib/notify/leadAlert';
import { normalizePhone } from '@/lib/phone';

/**
 * A WhatsApp message, sorted at the door.
 *
 * Three answers to "who is this". A number on an event, a couple or a
 * supplier: the box, where it is read and waits for a yes. A number on an
 * open enquiry: the enquiry's own timeline, and the producer is told the
 * couple wrote again. A number nobody knows: a new enquiry through the
 * same door the site form uses, with the fold-on-twin trigger standing
 * behind it as always.
 *
 * One producer per number. The business number is the platform's, so the
 * workspace is the platform's own, the same answer the site form gives.
 */

export type WhatsAppIn = {
  phone: string;
  name?: string;
  text: string;
  externalId: string;
  receivedAt?: string;
  attachments?: Attachment[];
};

async function platformProducer(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb.rpc('public_site_producer');
  if (error) { console.error('[inbound] no site producer', { message: error.message }); return null; }
  return typeof data === 'string' ? data : null;
}

export async function routeWhatsApp(sb: SupabaseClient, m: WhatsAppIn): Promise<{ to: 'inbox' | 'lead' | 'new-lead' | 'dropped'; id?: string }> {
  const producerId = await platformProducer(sb);
  if (!producerId) return { to: 'dropped' };
  const phone = normalizePhone(m.phone) ?? m.phone;

  const match = await resolveContext(sb, producerId, { phone });

  if (match.clientId || match.vendorId) {
    const got = await receiveInbox(sb, {
      producerId, channel: 'whatsapp', externalId: m.externalId, fromIdentity: phone, fromName: m.name ?? '',
      bodyText: m.text, attachments: m.attachments, receivedAt: m.receivedAt, clientId: match.clientId,
    });
    if (!got) return { to: 'dropped' };
    if (got.fresh) await processInbox(sb, got.id);
    return { to: 'inbox', id: got.id };
  }

  if (match.leadId) {
    await sb.from('lead_events').insert({
      lead_id: match.leadId, type: 'message_in', channel: 'whatsapp', body: m.text,
      meta: { external_id: m.externalId, attachments: m.attachments ?? [] },
    });
    await sb.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', match.leadId);
    const { data: lead } = await sb.from('leads')
      .select('id,producer_id,full_name,partner_name,event_date,guest_count,source,score,summary,message')
      .eq('id', match.leadId).maybeSingle();
    if (lead) await alertLead(sb, { ...(lead as AlertLead), message: m.text }, 'returning');
    return { to: 'lead', id: match.leadId };
  }

  /* Nobody knows the number: an enquiry. The shared door attributes it to
     the platform's workspace and the fold trigger watches for a twin. */
  const { data, error } = await sb.rpc('ingest_lead', {
    p_full_name: m.name ?? '', p_phone: phone, p_email: '', p_kind: 'wedding',
    p_event_date: null, p_guest_count: null, p_message: m.text, p_source: 'whatsapp',
    p_external_id: `whatsapp:${m.externalId}`, p_location: '',
  });
  if (error || !data) { console.error('[inbound] could not store the enquiry', { message: error?.message }); return { to: 'dropped' }; }
  await intakeLead(String(data), { extra: { source_payload: { whatsapp: m.externalId } } });
  return { to: 'new-lead', id: String(data) };
}

/** Ensures the bucket is there. Buckets are rows in storage, and sync.sql
 *  carries no rows, so the first upload makes it. Idempotent: "already
 *  exists" is the answer every time after the first. */
export async function ensureInboxBucket(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.storage.createBucket('inbox', { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.warn('[inbox] could not make the bucket', { message: error.message });
  }
}

/** Pulls a file from a URL the sender gave and puts it in the bucket. Best
 *  effort: a picture that could not be fetched is a line in the log and a
 *  message that still arrives. */
export async function fetchIntoInbox(sb: SupabaseClient, producerId: string, url: string, name: string, mime: string, headers?: Record<string, string>): Promise<Attachment | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 25_000_000) return null;
    await ensureInboxBucket(sb);
    const safe = name.replace(/[^\w.\-֐-׿]+/g, '_').slice(0, 80) || 'file';
    const path = `${producerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await sb.storage.from('inbox').upload(path, buf, { contentType: mime || 'application/octet-stream', upsert: false });
    if (error) return null;
    return { name: safe, mime: mime || res.headers.get('content-type') || 'application/octet-stream', path, size: buf.length };
  } catch (e) {
    console.warn('[inbox] could not fetch a file', { message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
