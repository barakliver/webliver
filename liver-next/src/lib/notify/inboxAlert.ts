import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/notify/push';

/**
 * When the box rings, and when it waits for the hour.
 *
 * The brief is specific and this follows it. A message from a couple that
 * the reading flagged for a person, or a document that looks like a
 * contract or an invoice: a push now. Everything else: counted, and said
 * once in the two-hourly line and in the morning letter. Never WhatsApp;
 * that channel is the enquiries' and the one that must not become noise.
 */

export async function ownerOf(sb: SupabaseClient, producerId: string): Promise<string | null> {
  const { data } = await sb.from('producers').select('owner_id').eq('id', producerId).maybeSingle();
  return (data as { owner_id?: string } | null)?.owner_id ?? null;
}

export async function alertInbox(sb: SupabaseClient, a: {
  producerId: string; itemId: string; summary: string; category: string;
  needsHuman: boolean; reason: string; fromCouple: boolean; pending: number;
}): Promise<void> {
  const urgent = (a.needsHuman && a.fromCouple) || a.category === 'contract' || a.category === 'vendor_invoice';
  if (!urgent) return;
  const owner = await ownerOf(sb, a.producerId);
  if (!owner) return;
  const title = a.category === 'contract' ? 'הגיע חוזה' : a.category === 'vendor_invoice' ? 'הגיעה חשבונית' : 'הודעה שצריך לקרוא';
  await Promise.all([
    sendPush(sb, owner, { title, body: (a.reason || a.summary).slice(0, 140), url: `/app/inbox#item-${a.itemId}`, tag: `inbox-${a.itemId}` }),
    sb.rpc('notify', { p_profile: owner, p_kind: 'task', p_title: title, p_body: a.summary.slice(0, 300), p_href: '/app/inbox' }),
  ]);
}

/** The two-hourly line: one push per producer with something waiting.
 *  Returns how many were sent. Once per two hours is the crontab's job;
 *  this only answers "is there anything". */
export async function sendInboxBatch(sb: SupabaseClient): Promise<{ sent: number; errors: string[] }> {
  const out = { sent: 0, errors: [] as string[] };
  const { data, error } = await sb.from('suggested_actions').select('producer_id,client_id').eq('status', 'pending');
  if (error) { out.errors.push(error.message); return out; }
  const by = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { producer_id: string; client_id: string | null }[]) {
    if (!by.has(r.producer_id)) by.set(r.producer_id, new Set());
    if (r.client_id) by.get(r.producer_id)?.add(r.client_id);
  }
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { producer_id: string }[]) counts.set(r.producer_id, (counts.get(r.producer_id) ?? 0) + 1);

  for (const [producerId, n] of counts) {
    const owner = await ownerOf(sb, producerId);
    if (!owner) continue;
    const events = by.get(producerId)?.size ?? 0;
    const r = await sendPush(sb, owner, {
      title: `${n} פעולות מחכות לאישור`, body: events ? `ב-${events} אירועים` : '', url: '/app/inbox', tag: 'inbox-batch',
    });
    if (r.error && !/not configured/.test(r.error)) out.errors.push(`${producerId}: ${r.error}`);
    else out.sent += 1;
  }
  return out;
}

/** The morning letter's line about the box. */
export async function inboxLine(sb: SupabaseClient, producerId: string, since: string): Promise<string> {
  const [{ count: fresh }, { count: pending }] = await Promise.all([
    sb.from('inbox_items').select('id', { count: 'exact', head: true }).eq('producer_id', producerId).gte('received_at', since),
    sb.from('suggested_actions').select('id', { count: 'exact', head: true }).eq('producer_id', producerId).eq('status', 'pending'),
  ]);
  if (!fresh && !pending) return '';
  return `• 📥 ${fresh ?? 0} פריטים חדשים בתיבה, ${pending ?? 0} מחכים לאישור`;
}

/** Yesterday's meeting with no summary on it: one push, with the way in.
 *  Only meetings that were held, by date, and only ones with nothing
 *  written; the producer who already wrote three lines is not nudged. */
export async function meetingFollowUps(sb: SupabaseClient, today: string): Promise<{ sent: number; errors: string[] }> {
  const out = { sent: 0, errors: [] as string[] };
  const yesterday = new Date(new Date(today + 'T00:00:00Z').getTime() - 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb.from('meeting_logs')
    .select('id,client_id,title,kind,summary,held_on')
    .eq('held_on', yesterday).eq('summary', '');
  if (error) { out.errors.push(error.message); return out; }
  for (const m of (data ?? []) as { id: string; client_id: string; title: string; kind: string }[]) {
    const { data: c } = await sb.from('clients').select('display_name,producer_id').eq('id', m.client_id).maybeSingle();
    const cl = c as { display_name?: string; producer_id?: string } | null;
    if (!cl?.producer_id) continue;
    const owner = await ownerOf(sb, cl.producer_id);
    if (!owner) continue;
    const r = await sendPush(sb, owner, {
      title: `לסכם את הפגישה עם ${cl.display_name ?? ''}?`,
      body: m.title || m.kind, url: `/app/clients/${m.client_id}?tab=meetings`, tag: `meeting-${m.id}`,
    });
    if (r.error && !/not configured/.test(r.error)) out.errors.push(`${m.id}: ${r.error}`);
    else out.sent += 1;
  }
  return out;
}
