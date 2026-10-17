import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveContext, eventFacts } from '@/lib/inbox/context';
import { readInbox } from '@/lib/ai/inboxRead';
import { validateAction } from '@/lib/inbox/kinds';
import { logAiCall } from '@/lib/ai/log';
import { alertInbox } from '@/lib/notify/inboxAlert';

/**
 * From "it arrived" to "it waits for a yes".
 *
 * `receiveInbox` writes the item, whole, and answers with its id; a sender
 * that retries meets the unique index and gets the same id back. `process`
 * does the rest: finds whose it is, reads it, writes what the reading
 * proposes, writes the log line that it arrived, and rings when the brief
 * says to. Every step after the first is best effort: the item is in the
 * box whatever the model does, and a failed reading is a status and a
 * reason on the item, not a lost message.
 */

export type Attachment = { name: string; mime: string; path: string; size: number };

export type Arrival = {
  producerId: string;
  channel: 'email' | 'whatsapp' | 'calendar' | 'upload' | 'voice';
  externalId?: string | null;
  fromIdentity?: string;
  fromName?: string;
  subject?: string;
  bodyText: string;
  attachments?: Attachment[];
  receivedAt?: string;
  /** Known at the door: an upload on an event file, a calendar entry. */
  clientId?: string | null;
};

export async function receiveInbox(sb: SupabaseClient, a: Arrival): Promise<{ id: string; fresh: boolean } | null> {
  const row = {
    producer_id: a.producerId, channel: a.channel, external_id: a.externalId ?? null,
    from_identity: (a.fromIdentity ?? '').slice(0, 200), from_name: (a.fromName ?? '').slice(0, 200),
    subject: (a.subject ?? '').slice(0, 500), body_text: a.bodyText.slice(0, 60000),
    attachments: a.attachments ?? [], received_at: a.receivedAt ?? new Date().toISOString(),
    client_id: a.clientId ?? null, match_confidence: a.clientId ? 'high' : '', match_reason: a.clientId ? 'ידוע בכניסה' : '',
  };
  const { data, error } = await sb.from('inbox_items').insert(row).select('id').single();
  if (!error && data) return { id: data.id, fresh: true };
  if (error?.code === '23505' && a.externalId) {
    const { data: had } = await sb.from('inbox_items').select('id')
      .eq('producer_id', a.producerId).eq('channel', a.channel).eq('external_id', a.externalId).maybeSingle();
    if (had) return { id: had.id, fresh: false };
  }
  console.error('[inbox] could not store the arrival', { code: error?.code, message: error?.message });
  return null;
}

type Item = {
  id: string; producer_id: string; channel: string; from_identity: string; from_name: string; subject: string;
  body_text: string; attachments: Attachment[]; client_id: string | null; vendor_id: string | null; lead_id: string | null;
  match_confidence: string; status: string;
};

async function producerName(sb: SupabaseClient, producerId: string): Promise<string> {
  const { data: pr } = await sb.from('producers').select('brand_name,owner_id').eq('id', producerId).maybeSingle();
  const p = pr as { brand_name?: string; owner_id?: string } | null;
  if (p?.owner_id) {
    const { data: prof } = await sb.from('profiles').select('full_name').eq('id', p.owner_id).maybeSingle();
    const n = (prof as { full_name?: string } | null)?.full_name;
    if (n) return n;
  }
  return p?.brand_name ?? '';
}

/** Attachments the model can read, pulled from the bucket. Capped at three
 *  and at a few megabytes each: a reading is not a backup. */
async function documentsOf(sb: SupabaseClient, items: Attachment[]): Promise<{ mime: string; base64: string; name: string }[]> {
  const out: { mime: string; base64: string; name: string }[] = [];
  for (const a of items.slice(0, 3)) {
    if (!/^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(a.mime) || a.size > 8_000_000) continue;
    const { data, error } = await sb.storage.from('inbox').download(a.path);
    if (error || !data) continue;
    out.push({ mime: a.mime, base64: Buffer.from(await data.arrayBuffer()).toString('base64'), name: a.name });
  }
  return out;
}

/**
 * `sb` is the service-role client: this runs from webhooks and from the
 * cron with nobody signed in. `rematchTo` is the sorting box's answer, when
 * a producer said whose this is.
 */
export async function processInbox(sb: SupabaseClient, itemId: string, rematchTo?: string | null): Promise<void> {
  const { data } = await sb.from('inbox_items').select('*').eq('id', itemId).maybeSingle();
  if (!data) return;
  const item = data as Item;

  /* Whose. A rematch wins; a client known at the door stands; otherwise ask
     the sender's phone and address. */
  let clientId = rematchTo ?? item.client_id;
  let vendorId = item.vendor_id;
  let leadId = item.lead_id;
  let confidence = rematchTo ? 'high' : item.match_confidence;
  let reason = rematchTo ? 'המפיק שייך' : item.client_id ? 'ידוע בכניסה' : '';
  let candidates: { id: string; name: string; date: string | null; venue: string }[] = [];

  if (!clientId) {
    const m = await resolveContext(sb, item.producer_id, {
      phone: item.channel === 'whatsapp' ? item.from_identity : null,
      email: item.channel === 'email' ? item.from_identity : null,
    });
    clientId = m.clientId; vendorId = m.vendorId; leadId = m.leadId;
    confidence = m.confidence; reason = m.reason; candidates = m.candidates;
  }

  const facts = clientId ? await eventFacts(sb, clientId) : null;
  const documents = await documentsOf(sb, item.attachments ?? []);
  const name = await producerName(sb, item.producer_id);

  const { reading, usage } = await readInbox({
    text: item.body_text, subject: item.subject, fromName: item.from_name, fromIdentity: item.from_identity,
    channel: item.channel, facts, candidates, documents, producerName: name,
  });
  await logAiCall(sb, {
    producer_id: item.producer_id, purpose: 'inbox_read', model: usage.model,
    input_tokens: usage.input, output_tokens: usage.output, latency_ms: usage.ms,
    ok: Boolean(reading), error: usage.error, ref_table: 'inbox_items', ref_id: item.id,
  });

  /* The reading may have named the event when the sender could not. */
  if (!clientId && reading?.client_id && candidates.some((c) => c.id === reading.client_id)) {
    clientId = reading.client_id; confidence = 'medium'; reason = 'זוהה מהטקסט';
  }

  const spam = reading?.category === 'spam';
  const status = !reading ? 'failed' : spam ? 'ignored' : !clientId && !vendorId && !leadId ? 'needs_review' : 'processed';

  await sb.from('inbox_items').update({
    client_id: clientId, vendor_id: vendorId, lead_id: leadId,
    match_confidence: confidence || 'low', match_reason: reason.slice(0, 300),
    status, ai_summary: reading?.summary_he ?? '', category: reading?.category ?? '',
    processed_at: new Date().toISOString(), error: reading ? '' : (usage.error ?? 'no reading').slice(0, 1000),
  }).eq('id', item.id);

  if (!reading || spam) return;

  /* What it proposes. Validated now so the screen never shows a proposal
     that would be refused at the press: a bad one is dropped here with a
     line in the log, and the good ones wait. */
  const rows = reading.actions
    .map((a) => ({ a, v: validateAction(a.kind, a.payload) }))
    .filter(({ a, v }) => {
      if (!v.ok) { console.warn('[inbox] dropped a proposal', { kind: a.kind, error: v.error }); return false; }
      return true;
    })
    .map(({ a }) => ({
      producer_id: item.producer_id, inbox_item_id: item.id, client_id: clientId,
      kind: a.kind, title: a.title_he, payload: a.payload, confidence: a.confidence,
      status: 'pending',
    }));
  /* Only on a replay through the sorting box do old proposals exist. */
  await sb.from('suggested_actions').delete().eq('inbox_item_id', item.id).eq('status', 'pending');
  if (rows.length) await sb.from('suggested_actions').insert(rows);

  /* It arrived: always on the log, with whom it was about. */
  if (clientId) {
    await sb.from('activity_log').insert({
      producer_id: item.producer_id, client_id: clientId, vendor_id: vendorId,
      kind: `${item.channel}_in`, title: reading.summary_he || item.subject || 'הגיע פריט',
      ref_table: 'inbox_items', ref_id: item.id,
      actor: vendorId ? 'vendor' : leadId ? 'couple' : item.channel === 'upload' ? 'producer' : 'couple',
    });
  }

  await alertInbox(sb, {
    producerId: item.producer_id, itemId: item.id, summary: reading.summary_he, category: reading.category,
    needsHuman: reading.needs_human, reason: reading.needs_human_reason, fromCouple: !vendorId && item.channel !== 'upload',
    pending: rows.length,
  });
}
