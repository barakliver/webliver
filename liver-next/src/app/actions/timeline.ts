'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';
import { todayInZone } from '@/lib/clock';
import {
  buildTimeline, TIMELINE_CATEGORIES, type Owner, type TimelineCategory,
} from '@/content/timeline';

export type TimelineResult = { ok: boolean; error?: string; added?: number; skipped?: number };

export type TimelineChoice = {
  guests: number | null;
  abroad: boolean;
  owners: Partial<Record<TimelineCategory, Owner>>;
};

/** The choices, as they are allowed to arrive from a browser. */
function cleanChoice(raw: unknown): TimelineChoice {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const guests = Number(o.guests);
  const owners: Partial<Record<TimelineCategory, Owner>> = {};
  const given = (o.owners && typeof o.owners === 'object' ? o.owners : {}) as Record<string, unknown>;
  for (const cat of TIMELINE_CATEGORIES) {
    const v = given[cat];
    if (v === 'producer' || v === 'client') owners[cat] = v;
  }
  return {
    guests: Number.isFinite(guests) && guests > 0 ? Math.min(5000, Math.round(guests)) : null,
    abroad: o.abroad === true,
    owners,
  };
}

/**
 * The year's plan, written into this event's tasks.
 *
 * Built again here from the same inputs rather than trusted from the screen,
 * so what lands is what the content file says and not what a request body
 * said. A step whose title is already on the list is left alone, which is
 * what makes pressing the button twice safe: it fills in what is missing
 * and reports how many that was. Each task remembers which step it came
 * from, its reminder, and the supplier it stands for, so ticking "לסגור צלם"
 * asks who and for how much like the checklist does.
 */
export async function applyTimeline(clientId: string, raw: unknown): Promise<TimelineResult> {
  const account = await requireLiveProducer();
  if (!account.producer?.id) return { ok: false, error: 'אין מרחב הפקה פעיל' };
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const choice = cleanChoice(raw);
  const sb = await supabaseServer();

  const { data: client, error: clientError } = await sb
    .from('clients').select('id,event_date').eq('id', clientId).maybeSingle();
  if (clientError || !client) return { ok: false, error: 'לא מצאנו את האירוע' };
  if (!client.event_date) return { ok: false, error: 'לאירוע אין עדיין תאריך, ואי אפשר לפרוס תוכנית בלי אחד' };

  const plan = buildTimeline({
    eventDate: String(client.event_date),
    today: todayInZone(),
    guests: choice.guests,
    abroad: choice.abroad,
    owners: choice.owners,
  });
  if (plan.rows.length === 0) return { ok: false, error: 'לא הצלחנו לבנות את התוכנית' };

  /* The celebration the tasks hang off, when the workspace has one: the
     checklist's own form opens only for a task that belongs to an event. */
  const [{ data: existing }, { data: events }] = await Promise.all([
    sb.from('tasks').select('title').eq('client_id', clientId),
    sb.from('events').select('id').eq('client_id', clientId)
      .order('event_date', { ascending: true, nullsFirst: false }).limit(1),
  ]);
  const have = new Set((existing ?? []).map((t) => String(t.title).trim()));
  const eventId = events?.[0]?.id ?? null;

  const rows = plan.rows
    .filter((r) => !have.has(r.title))
    .map((r) => ({
      client_id: clientId,
      event_id: eventId,
      title: r.title,
      due_on: r.dueOn,
      owner: r.owner,
      visible_to_client: r.visibleToClient,
      category: r.vendor ?? '',
      remind_days: r.remindDays,
      created_by: account.id,
    }));

  if (rows.length === 0) return { ok: true, added: 0, skipped: plan.rows.length };

  const { error } = await sb.from('tasks').insert(rows);
  if (error) {
    console.error('[timeline] apply failed', { message: error.message });
    return { ok: false, error: 'לא הצלחנו להוסיף את השלבים למשימות' };
  }

  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
  return { ok: true, added: rows.length, skipped: plan.rows.length - rows.length };
}
