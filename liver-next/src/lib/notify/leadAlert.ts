import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWhatsApp } from '@/lib/notify/whatsapp';
import { sendPush } from '@/lib/notify/push';
import { leadsCopy } from '@/content/site';
import { publicEnv } from '@/lib/env';
import { EVENT_ZONE } from '@/lib/clock';
import { RING_ANYWAY } from '@/lib/leadScore';
import { inQuietHours } from '@/lib/quietHours';

/**
 * Telling the producer an enquiry arrived, within seconds, with a way in.
 *
 * Three channels, one message. WhatsApp through the webhook the producer
 * already configured, a push to every phone they said yes on, and the bell
 * in the app, which the insert trigger already rang. The text is the same
 * everywhere: who, when, how many, how good, and a link that opens the card.
 *
 * Quiet hours are the producer's own, from notification_preferences, read
 * in the events' zone. Between them WhatsApp stays silent and the push goes
 * out without a sound, so the morning finds it rather than the night. One
 * exception, and it is in the brief: a lead scoring eighty or more rings
 * whatever the hour, because that is the enquiry that is answered by
 * whoever answers first.
 */

export type AlertLead = {
  id: string;
  producer_id: string;
  full_name: string;
  partner_name?: string | null;
  event_date: string | null;
  guest_count: number | null;
  source: string;
  score: number | null;
  summary?: string | null;
  message?: string | null;
};

type Prefs = {
  whatsapp_number: string; push_enabled: boolean;
  quiet_start: string | null; quiet_end: string | null;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: EVENT_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });

export function sourceLabel(source: string): string {
  const map = leadsCopy.sources as Record<string, string>;
  return map[source] ?? source.replace(/_/g, ' ');
}

/** The WhatsApp line, built once and tested. `kind` picks the first word. */
export function leadAlertText(l: AlertLead, kind: 'new' | 'returning'): string {
  const who = l.partner_name ? `${l.full_name} ו${l.partner_name}` : l.full_name;
  const when = l.event_date ? dateFmt.format(new Date(l.event_date + 'T00:00:00')) : 'תאריך לא ידוע';
  const guests = l.guest_count ? `${l.guest_count} אורחים` : '? אורחים';
  const score = l.score === null || l.score === undefined ? '' : `ציון ${l.score}/100`;
  const summary = (l.summary || l.message || '').trim().slice(0, 160);
  return [
    `🔔 ${kind === 'returning' ? 'ליד חוזר' : 'ליד חדש'} · ${sourceLabel(l.source)}`,
    `${who} · ${when} · ${guests}`,
    [score, summary].filter(Boolean).join(' · '),
    `👉 ${publicEnv.siteUrl}/app/leads/${l.id}`,
  ].filter(Boolean).join('\n');
}

export type AlertOutcome = { whatsapp: boolean; push: number; quiet: boolean; skipped?: string };

/**
 * `sb` must be the service-role client: it runs from a webhook with nobody
 * signed in, and the preferences and subscriptions it reads belong to the
 * producer, not to the caller.
 */
export async function alertLead(
  sb: SupabaseClient, lead: AlertLead, kind: 'new' | 'returning', now: Date = new Date(),
): Promise<AlertOutcome> {
  const { data: pr } = await sb.from('producers').select('owner_id').eq('id', lead.producer_id).maybeSingle();
  const owner = (pr as { owner_id?: string } | null)?.owner_id;
  if (!owner) return { whatsapp: false, push: 0, quiet: false, skipped: 'no owner' };

  const { data: p } = await sb.from('notification_preferences')
    .select('whatsapp_number,push_enabled,quiet_start,quiet_end')
    .eq('profile_id', owner).maybeSingle();
  const prefs = (p as Prefs | null) ?? { whatsapp_number: '', push_enabled: true, quiet_start: null, quiet_end: null };

  const clock = clockFmt.format(now);
  const quiet = inQuietHours(clock, prefs.quiet_start, prefs.quiet_end)
    && !((lead.score ?? 0) >= RING_ANYWAY);

  const text = leadAlertText(lead, kind);
  const results = await Promise.allSettled([
    quiet ? Promise.resolve({ sent: false }) : sendWhatsApp(text),
    prefs.push_enabled
      ? sendPush(sb, owner, {
          title: `${kind === 'returning' ? 'ליד חוזר' : 'ליד חדש'}: ${lead.full_name}`,
          body: (lead.summary || lead.message || sourceLabel(lead.source)).slice(0, 140),
          url: `/app/leads/${lead.id}`,
          tag: `lead-${lead.id}`,
          silent: quiet,
        })
      : Promise.resolve({ sent: 0, gone: 0 }),
  ]);

  const wa = results[0].status === 'fulfilled' && (results[0].value as { sent: boolean }).sent;
  const push = results[1].status === 'fulfilled' ? (results[1].value as { sent: number }).sent : 0;

  /* The timeline says it rang, so "did you get the alert" has an answer. */
  await sb.from('lead_events').insert({
    lead_id: lead.id, type: 'notification_sent', channel: 'system',
    body: [wa ? 'וואטסאפ' : '', push ? `פוש ×${push}` : '', quiet ? 'שעות שקט' : ''].filter(Boolean).join(' · ') || 'לא נשלח',
    meta: { whatsapp: wa, push, quiet, kind },
  });

  if (kind === 'returning') {
    await sb.rpc('notify', {
      p_profile: owner, p_kind: 'lead', p_title: 'ליד חוזר',
      p_body: lead.full_name, p_href: `/app/leads/${lead.id}`,
    });
  }

  return { whatsapp: wa, push, quiet };
}
