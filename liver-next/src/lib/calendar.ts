import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── Everything with a date on it, in one list ─────────────────────────────
   A producer's calendar is not only the weddings. It is the weddings, the
   things due before them, and the money that has to arrive in between — and
   the reason to look at a calendar rather than three separate screens is to
   see them against each other.                                              */

export type CalKind = 'event' | 'task' | 'payment' | 'entry';

/* Supabase embeds a to-one relation as an object, but the generated types
   describe it as an array where the key is not provably unique. Reading both
   shapes is one line and costs nothing; guessing wrong is a colour that
   silently never appears. */
const embeddedColor = (v: unknown): string | null => {
  const row = Array.isArray(v) ? v[0] : v;
  const color = (row as { color?: unknown } | null | undefined)?.color;
  return typeof color === 'string' ? color : null;
};

export type CalItem = {
  id: string;
  kind: CalKind;
  /** The row's own id, for the drawer that edits an entry. */
  rowId?: string;
  /** hh:mm, on an entry that has one. */
  time?: string;
  /** Calendar date, yyyy-mm-dd, in the event's own timezone. */
  date: string;
  title: string;
  detail: string;
  href: string;
  clientId: string;
  /** Money items carry theirs; the rest do not. */
  amount?: number;
  /** The producer's own colour for the event this belongs to. */
  color?: string | null;
  done?: boolean;
};

export async function getCalendar(sb: SupabaseClient): Promise<CalItem[]> {
  /* Archived events are finished work and do not belong on a forward-looking
     screen, the same rule the overview follows. */
  const { data: clients } = await sb
    .from('clients')
    .select('id,display_name,event_date,venue,guest_estimate,producer_labels(color)')
    .is('archived_at', null);

  const rows = clients ?? [];
  const ids = rows.map((c) => c.id);
  const nameOf = new Map(rows.map((c) => [c.id, c.display_name]));
  const colorOf = new Map(rows.map((c) => [
    c.id,
    embeddedColor((c as { producer_labels?: unknown }).producer_labels),
  ]));

  const [tasksQ, paysQ] = ids.length
    ? await Promise.all([
        sb.from('tasks').select('id,client_id,title,due_on,done,owner')
          .in('client_id', ids).not('due_on', 'is', null),
        sb.from('payments').select('id,client_id,title,amount,due_on,paid')
          .in('client_id', ids).not('due_on', 'is', null),
      ])
    : [{ data: [] }, { data: [] }];
  /* The producer's own entries: the row policy scopes them, and an entry
     on no event is still on the diary. */
  const entriesQ = await sb.from('diary_entries')
    .select('id,client_id,title,on_date,at_time,note').order('at_time', { ascending: true, nullsFirst: true });

  const items: CalItem[] = [];

  for (const c of rows) {
    if (!c.event_date) continue;
    items.push({
      id: `event-${c.id}`,
      kind: 'event',
      date: c.event_date,
      title: c.display_name,
      detail: [c.venue, c.guest_estimate ? `${c.guest_estimate} אורחים` : ''].filter(Boolean).join(' · '),
      href: `/app/clients/${c.id}`,
      clientId: c.id,
      color: colorOf.get(c.id) ?? null,
    });
  }

  for (const t of tasksQ.data ?? []) {
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      date: t.due_on!,
      title: t.title,
      detail: nameOf.get(t.client_id) ?? '',
      href: `/app/clients/${t.client_id}`,
      clientId: t.client_id,
      color: colorOf.get(t.client_id) ?? null,
      done: t.done,
    });
  }

  for (const p of paysQ.data ?? []) {
    items.push({
      id: `pay-${p.id}`,
      kind: 'payment',
      date: p.due_on!,
      title: p.title,
      detail: nameOf.get(p.client_id) ?? '',
      href: `/app/clients/${p.client_id}`,
      clientId: p.client_id,
      color: colorOf.get(p.client_id) ?? null,
      amount: Number(p.amount) || 0,
      done: p.paid,
    });
  }

  for (const e of (entriesQ.data ?? []) as { id: string; client_id: string | null; title: string; on_date: string; at_time: string | null; note: string }[]) {
    const time = e.at_time ? e.at_time.slice(0, 5) : '';
    items.push({
      id: `entry-${e.id}`,
      rowId: e.id,
      kind: 'entry',
      date: e.on_date,
      time,
      title: time ? `${time} ${e.title}` : e.title,
      detail: [e.client_id ? nameOf.get(e.client_id) ?? '' : '', e.note].filter(Boolean).join(' · '),
      href: `/app/calendar?day=${e.on_date}`,
      clientId: e.client_id ?? '',
      color: e.client_id ? colorOf.get(e.client_id) ?? null : null,
    });
  }

  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
