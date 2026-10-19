import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWhatsApp } from '@/lib/notify/whatsapp';
import { sendPush } from '@/lib/notify/push';
import { publicEnv } from '@/lib/env';
import { EVENT_ZONE, todayInZone } from '@/lib/clock';
import { UNANSWERED_AFTER_MS } from '@/lib/pipeline';
import { inboxLine } from '@/lib/notify/inboxAlert';

/**
 * The morning letter about enquiries, and the two nudges during the day.
 *
 * The morning one is a count, not a list: how many arrived since yesterday,
 * how many are still waiting, how many have waited past two days, and what
 * was written down for today. Sent once a day per producer, by WhatsApp
 * and by push, and only when there is something in it; a letter that says
 * "nothing" every morning is a letter that gets filtered by the second
 * week. The bell carries it too, so the day's first screen shows it.
 *
 * The nudges are the brief's two lines. Two hours in `new` with nobody
 * having answered, during the working day: a push. Twenty-four hours: a
 * WhatsApp. Each once per card, remembered on the card's own timeline as a
 * `notification_sent` with the line it was, so a sweep that runs every
 * hour does not ring every hour.
 *
 * Everything runs under the service role from the cron, which is why every
 * read here is scoped by producer by hand.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type ProducerRow = { id: string; owner_id: string | null; brand_name: string | null };
type LeadRow = {
  id: string; producer_id: string; full_name: string; status: string; created_at: string;
  first_response_at: string | null; next_action: string; next_action_at: string | null;
};

const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: EVENT_ZONE, hour: '2-digit', hour12: false });
const timeFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, hour: '2-digit', minute: '2-digit' });

/** The producer's working day, in the events' zone. Eight to eight. */
export function inWorkingHours(now: Date): boolean {
  const h = Number(clockFmt.format(now));
  return h >= 8 && h < 20;
}

async function firstName(sb: SupabaseClient, ownerId: string): Promise<string> {
  const { data } = await sb.from('profiles').select('full_name').eq('id', ownerId).maybeSingle();
  return String((data as { full_name?: string } | null)?.full_name ?? '').split(' ')[0];
}

export async function sendMorningDigest(sb: SupabaseClient, now: Date = new Date()): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const out = { sent: 0, skipped: 0, errors: [] as string[] };
  const today = todayInZone(now);
  const { data: producers, error } = await sb.from('producers').select('id,owner_id,brand_name');
  if (error) { out.errors.push(`producers: ${error.message}`); return out; }

  for (const pr of (producers ?? []) as ProducerRow[]) {
    if (!pr.owner_id) continue;

    /* Once a day. The bell row is the record: a second run on the same
       morning finds it and stops. */
    const { data: already } = await sb.from('notifications')
      .select('id').eq('profile_id', pr.owner_id).eq('kind', 'lead').eq('title', 'בוקר טוב')
      .gte('created_at', `${today}T00:00:00+02:00`).limit(1);
    if (already?.length) { out.skipped += 1; continue; }

    const { data: leads } = await sb.from('leads')
      .select('id,producer_id,full_name,status,created_at,first_response_at,next_action,next_action_at')
      .eq('producer_id', pr.id)
      .gte('created_at', new Date(now.getTime() - 90 * DAY).toISOString());
    const rows = (leads ?? []) as LeadRow[];

    const since = now.getTime() - DAY;
    const fresh = rows.filter((l) => new Date(l.created_at).getTime() >= since);
    const waiting = rows.filter((l) => l.status === 'new' && !l.first_response_at);
    const stale = waiting.filter((l) => now.getTime() - new Date(l.created_at).getTime() > 48 * HOUR);
    const todays = rows.filter((l) => l.next_action && l.next_action_at && todayInZone(new Date(l.next_action_at)) === today)
      .sort((a, b) => String(a.next_action_at).localeCompare(String(b.next_action_at)));

    const box = await inboxLine(sb, pr.id, new Date(since).toISOString());
    if (!fresh.length && !waiting.length && !todays.length && !box) { out.skipped += 1; continue; }

    const name = await firstName(sb, pr.owner_id);
    const lines = [
      `☀️ בוקר טוב${name ? ` ${name}` : ''}`,
      `• ${fresh.length} לידים חדשים מאתמול, ${waiting.length} עדיין בלי מענה`,
      stale.length ? `• ${stale.length} לידים שלא טופלו מעל 48 שעות ⚠️` : '',
      todays.length
        ? `• היום: ${todays.map((l) => `${l.full_name}: ${l.next_action} (${timeFmt.format(new Date(l.next_action_at as string))})`).join(' · ')}`
        : '',
      box,
      `👉 ${publicEnv.appUrl}/app/leads`,
    ].filter(Boolean);
    const text = lines.join('\n');

    const [wa, push] = await Promise.all([
      sendWhatsApp(text),
      sendPush(sb, pr.owner_id, {
        title: lines[0], body: lines.slice(1, -1).join('\n'), url: '/app/leads', tag: 'morning',
      }),
    ]);
    if (wa.error && !/not configured/.test(wa.error)) out.errors.push(`${pr.id} whatsapp: ${wa.error}`);
    if (push.error && !/not configured/.test(push.error)) out.errors.push(`${pr.id} push: ${push.error}`);

    await sb.rpc('notify', {
      p_profile: pr.owner_id, p_kind: 'lead', p_title: 'בוקר טוב',
      p_body: lines.slice(1, -1).join(' '), p_href: '/app/leads',
    });
    out.sent += 1;
  }
  return out;
}

type Marker = { lead_id: string; meta: { sla?: string } | null };

export async function sendLeadSla(sb: SupabaseClient, now: Date = new Date()): Promise<{ pushed: number; messaged: number; errors: string[] }> {
  const out = { pushed: 0, messaged: 0, errors: [] as string[] };
  const { data: leads, error } = await sb.from('leads')
    .select('id,producer_id,full_name,status,created_at,first_response_at,next_action,next_action_at')
    .eq('status', 'new').is('first_response_at', null)
    .lte('created_at', new Date(now.getTime() - UNANSWERED_AFTER_MS).toISOString())
    .gte('created_at', new Date(now.getTime() - 14 * DAY).toISOString());
  if (error) { out.errors.push(`leads: ${error.message}`); return out; }
  const rows = (leads ?? []) as LeadRow[];
  if (!rows.length) return out;

  const { data: marks } = await sb.from('lead_events')
    .select('lead_id,meta').eq('type', 'notification_sent')
    .in('lead_id', rows.map((l) => l.id));
  const done = new Set((marks ?? [] as Marker[]).filter((m) => m.meta?.sla).map((m) => `${m.lead_id}:${m.meta?.sla}`));

  const owners = new Map<string, string>();
  const ownerOf = async (producerId: string) => {
    if (!owners.has(producerId)) {
      const { data } = await sb.from('producers').select('owner_id').eq('id', producerId).maybeSingle();
      owners.set(producerId, String((data as { owner_id?: string } | null)?.owner_id ?? ''));
    }
    return owners.get(producerId) || null;
  };

  const working = inWorkingHours(now);
  for (const l of rows) {
    const age = now.getTime() - new Date(l.created_at).getTime();
    const owner = await ownerOf(l.producer_id);
    if (!owner) continue;
    const href = `/app/leads/${l.id}`;

    if (age > DAY && !done.has(`${l.id}:24h`)) {
      const r = await sendWhatsApp(`⏰ ${l.full_name} מחכים יותר מיממה בלי מענה\n👉 ${publicEnv.appUrl}${href}`);
      if (r.error && !/not configured/.test(r.error)) out.errors.push(`${l.id}: ${r.error}`);
      await sb.from('lead_events').insert({
        lead_id: l.id, type: 'notification_sent', channel: 'system',
        body: 'תזכורת: יממה בלי מענה', meta: { sla: '24h', whatsapp: r.sent },
      });
      out.messaged += 1;
      continue;
    }

    if (working && !done.has(`${l.id}:2h`) && !done.has(`${l.id}:24h`)) {
      const r = await sendPush(sb, owner, {
        title: `עוד לא ענית ל${l.full_name}`, body: 'שעתיים מאז שכתבו', url: href, tag: `sla-${l.id}`,
      });
      if (r.error && !/not configured/.test(r.error)) out.errors.push(`${l.id}: ${r.error}`);
      await sb.from('lead_events').insert({
        lead_id: l.id, type: 'notification_sent', channel: 'system',
        body: 'תזכורת: שעתיים בלי מענה', meta: { sla: '2h', push: r.sent },
      });
      out.pushed += 1;
    }
  }
  return out;
}
