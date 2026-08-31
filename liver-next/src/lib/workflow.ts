import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Template } from '@/components/app/WorkflowTemplates';
import type { Anniversary } from '@/components/app/Anniversaries';

/**
 * The two things 0042 built and nothing rendered.
 *
 * Both reads are the producer's own: row level security scopes templates and
 * reminders to whoever owns them, so neither query filters by producer and
 * neither needs to.
 */

export async function loadTemplates(sb: SupabaseClient): Promise<Template[]> {
  const { data, error } = await sb
    .from('producer_workflow_templates')
    .select('id,name,kind,steps,created_at')
    .order('sort_order')
    .order('created_at');

  if (error) {
    console.error('[workflow] could not read templates', { message: error.message });
    return [];
  }
  return (data ?? []) as Template[];
}

/**
 * The anniversaries worth showing, one row per event.
 *
 * Three reminders are scheduled per event and only the nearest one that has
 * not fired is news. Showing all three would put the same wedding on the
 * screen three times, two of them for dates months apart, which reads as three
 * events rather than one with a schedule.
 *
 * The couple's addresses ride along so the greeting button has somewhere to
 * send to. They are already readable here — this is the producer's own event.
 */
export async function loadAnniversaries(sb: SupabaseClient): Promise<Anniversary[]> {
  const { data, error } = await sb
    .from('anniversary_reminders')
    .select('id,client_id,milestone,due_on,event_date,couple,sent_at')
    .is('cancelled_at', null)
    .order('due_on')
    .limit(60);

  if (error) {
    console.error('[workflow] could not read anniversaries', { message: error.message });
    return [];
  }

  type Row = {
    id: string; client_id: string; milestone: string; due_on: string;
    event_date: string; couple: string; sent_at: string | null;
  };

  const rows = (data ?? []) as Row[];

  /* The nearest unsent milestone per event. Ordered by due_on already, so the
     first one seen for a client is the one to keep. */
  const nearest = new Map<string, Row>();
  for (const r of rows) {
    if (r.sent_at) continue;
    if (!nearest.has(r.client_id)) nearest.set(r.client_id, r);
  }
  if (nearest.size === 0) return [];

  const ids = [...nearest.keys()];
  const { data: people } = await sb
    .from('client_authorized_emails')
    .select('client_id,email')
    .in('client_id', ids);

  const byClient = new Map<string, string[]>();
  for (const p of (people ?? []) as { client_id: string; email: string }[]) {
    const list = byClient.get(p.client_id) ?? [];
    list.push(p.email);
    byClient.set(p.client_id, list);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...nearest.values()].map((r) => {
    const due = new Date(r.due_on);
    return {
      id: r.id,
      clientId: r.client_id,
      milestone: r.milestone as Anniversary['milestone'],
      dueOn: r.due_on,
      eventDate: r.event_date,
      couple: r.couple,
      /* Negative means the day has passed and the sweep has not run yet, which
         is worth showing rather than hiding: it is the one state that means
         something is wrong with the schedule. */
      daysAway: Math.round((due.getTime() - today.getTime()) / 86_400_000),
      emails: byClient.get(r.client_id) ?? [],
    };
  });
}
