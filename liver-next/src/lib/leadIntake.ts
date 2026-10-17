import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { readLead, worthReading } from '@/lib/ai/leadRead';
import { scoreLead } from '@/lib/leadScore';
import { alertLead } from '@/lib/notify/leadAlert';
import { todayInZone } from '@/lib/clock';
import { optional } from '@/lib/env';

/**
 * What happens to an enquiry after it is a row.
 *
 * Every door ends here with an id: the site form, the channel address, the
 * normalised endpoint, the WhatsApp webhook, a phone call typed in. The
 * card is read if there is a paragraph to read, scored by the rules in
 * leadScore, and announced. Each step is best effort beside the one that
 * matters, which already happened: the row exists. A model that is down or
 * a WhatsApp webhook that is unset costs the producer a summary or a ping,
 * never the lead.
 *
 * `returning` is decided here from the row's age, because the fold trigger
 * answers with the twin's id and nothing else. A card older than a minute
 * did not just arrive; what just arrived is the message on its timeline.
 */

export type IntakeOptions = {
  /** Extra fields the door knew that store_lead does not take. Written only
   *  onto a card that was just made; a twin keeps what it had. */
  extra?: {
    partner_name?: string; instagram_handle?: string; event_date_flexible?: boolean | null;
    budget_min?: number | null; budget_max?: number | null; venue_booked?: boolean | null;
    source_payload?: unknown;
  };
};

type Row = {
  id: string; producer_id: string | null; full_name: string; partner_name: string;
  phone: string; email: string; kind: string; event_date: string | null; guest_count: number | null;
  message: string; location: string; source: string; status: string; created_at: string;
  intent: string; score: number | null; summary: string; budget_min: number | null; budget_max: number | null;
};

const FRESH_MS = 60_000;

export async function intakeLead(leadId: string, opts: IntakeOptions = {}): Promise<void> {
  if (!leadId || !optional('SUPABASE_SERVICE_ROLE_KEY')) return;
  let sb: ReturnType<typeof supabaseAdmin>;
  try { sb = supabaseAdmin(); } catch { return; }

  const { data, error } = await sb.from('leads')
    .select('id,producer_id,full_name,partner_name,phone,email,kind,event_date,guest_count,message,location,source,status,created_at,intent,score,summary,budget_min,budget_max')
    .eq('id', leadId).maybeSingle();
  if (error || !data) {
    if (error) console.error('[intake] could not read the lead', { code: error.code, message: error.message });
    return;
  }
  const lead = data as Row;
  if (!lead.producer_id) return;

  const fresh = Date.now() - new Date(lead.created_at).getTime() < FRESH_MS;

  const patch: Record<string, unknown> = {};
  if (fresh && opts.extra) {
    const x = opts.extra;
    if (x.partner_name) patch.partner_name = x.partner_name.slice(0, 120);
    if (x.instagram_handle) patch.instagram_handle = x.instagram_handle.slice(0, 80);
    if (typeof x.event_date_flexible === 'boolean') patch.event_date_flexible = x.event_date_flexible;
    if (typeof x.budget_min === 'number') patch.budget_min = x.budget_min;
    if (typeof x.budget_max === 'number') patch.budget_max = x.budget_max;
    if (typeof x.venue_booked === 'boolean') patch.venue_booked = x.venue_booked;
    if (x.source_payload !== undefined) patch.source_payload = x.source_payload;
  }

  /* The reading. Only on a fresh card with a paragraph on it, and only once:
     a twin that already carries a summary keeps it, and the new message is
     on its timeline for the producer to read. */
  let intent = lead.intent;
  if (fresh && worthReading(lead.message) && !lead.summary) {
    const { data: pr } = await sb.from('producers').select('brand_name,owner_id').eq('id', lead.producer_id).maybeSingle();
    const prod = pr as { brand_name?: string; owner_id?: string } | null;
    const { data: prof } = prod?.owner_id
      ? await sb.from('profiles').select('full_name').eq('id', prod.owner_id).maybeSingle()
      : { data: null };
    const reading = await readLead({
      message: lead.message,
      known: {
        full_name: lead.full_name, phone: lead.phone, email: lead.email,
        event_date: lead.event_date, guest_count: lead.guest_count, location: lead.location,
        source: lead.source, kind: lead.kind,
      },
      producer: {
        name: (prof as { full_name?: string } | null)?.full_name || prod?.brand_name || '',
        brand: prod?.brand_name || '',
      },
    });
    if (reading) {
      /* Fill what is blank; never overwrite what the person typed. */
      if (!lead.partner_name && reading.partner_name && !patch.partner_name) patch.partner_name = reading.partner_name;
      if (!lead.event_date && reading.event_date) patch.event_date = reading.event_date;
      if (reading.date_flexible !== null && patch.event_date_flexible === undefined) patch.event_date_flexible = reading.date_flexible;
      if (!lead.guest_count && reading.guest_count) patch.guest_count = reading.guest_count;
      if (lead.budget_min === null && reading.budget_min !== null && patch.budget_min === undefined) patch.budget_min = reading.budget_min;
      if (lead.budget_max === null && reading.budget_max !== null && patch.budget_max === undefined) patch.budget_max = reading.budget_max;
      if (!lead.location && reading.region) patch.location = reading.region.slice(0, 120);
      if (reading.venue_booked !== null && patch.venue_booked === undefined) patch.venue_booked = reading.venue_booked;
      if (reading.intent) { patch.intent = reading.intent; intent = reading.intent; }
      if (reading.urgency) patch.urgency = reading.urgency;
      if (reading.summary_he) patch.summary = reading.summary_he;
      if (reading.suggested_reply_he) patch.suggested_reply = reading.suggested_reply_he;

      await sb.from('lead_events').insert({
        lead_id: lead.id, type: 'ai_summary', channel: 'system',
        body: reading.summary_he || '',
        meta: { intent: reading.intent, urgency: reading.urgency, suggested_reply: reading.suggested_reply_he },
      });
    }
  }

  /* The score, from the card as it stands after the reading. Re-scored on a
     twin too: a second message with a date in it is a better lead. */
  const scored = scoreLead({
    event_date: (patch.event_date as string | undefined) ?? lead.event_date,
    intent,
    phone: lead.phone, email: lead.email,
    budget_min: (patch.budget_min as number | undefined) ?? lead.budget_min,
    budget_max: (patch.budget_max as number | undefined) ?? lead.budget_max,
    source: lead.source,
  }, todayInZone());
  patch.score = scored.score;
  patch.score_reason = scored.reason;

  const spam = intent === 'spam';
  if (spam && fresh) {
    patch.status = 'lost';
    patch.lost_reason = 'spam';
  }

  const { error: upErr } = await sb.from('leads').update(patch).eq('id', lead.id);
  if (upErr) console.error('[intake] could not write the reading', { code: upErr.code, message: upErr.message });

  if (spam) return;

  await alertLead(sb, {
    id: lead.id, producer_id: lead.producer_id,
    full_name: lead.full_name,
    partner_name: (patch.partner_name as string | undefined) ?? lead.partner_name,
    event_date: (patch.event_date as string | undefined) ?? lead.event_date,
    guest_count: (patch.guest_count as number | undefined) ?? lead.guest_count,
    source: lead.source, score: scored.score,
    summary: (patch.summary as string | undefined) ?? lead.summary,
    message: lead.message,
  }, fresh ? 'new' : 'returning');
}
