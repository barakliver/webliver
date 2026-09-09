import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { assess, type Gap } from '@/lib/gaps';

export type { Gap, GapLevel } from '@/lib/gaps';

/* ── The state of every event, in one place ────────────────────────────────
   The clients list showed a name, a date, a venue and a guest count. All true,
   none of it the thing a producer opens the screen to find out, which is:
   which of these needs me, and what is missing.

   So each event carries its gaps. A gap is something that should exist by now
   and does not, judged against how close the event is — an empty guest list is
   nothing at ten months out and a problem at six weeks. Every gap names one
   specific missing thing, because "incomplete" is a feeling and "no run sheet,
   three weeks out" is a job.                                                  */

export type ClientStatus = {
  id: string;
  name: string;
  kind: string;
  eventDate: string | null;
  venue: string;
  guestEstimate: number | null;
  archivedAt: string | null;
  /** Whole days until the event; negative once it has passed. Null with no date. */
  daysLeft: number | null;
  gaps: Gap[];
  /** The nearest open producer task, if there is one. */
  nextTask: { title: string; dueOn: string | null } | null;
  guests: { invited: number; attending: number };
  money: { owed: number; overdue: number };
  /** True once the date has passed and the producer has not closed it. */
  needsClosing: boolean;
};

const DAY = 86_400_000;

function daysUntil(iso: string, today: number): number {
  return Math.round((new Date(iso + 'T00:00:00').getTime() - today) / DAY);
}

export async function getBoard(opts: { archived?: boolean } = {}): Promise<ClientStatus[]> {
  const sb = await supabaseServer();
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = new Date(todayIso + 'T00:00:00').getTime();

  let q = sb
    .from('clients')
    .select('id,display_name,kind,event_date,venue,guest_estimate,archived_at');
  q = opts.archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);

  const { data } = await q.order('event_date', { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as {
    id: string; display_name: string; kind: string; event_date: string | null;
    venue: string; guest_estimate: number | null; archived_at: string | null;
  }[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  /* Six queries for the whole board rather than six per event. Row level
     security scopes each one to this producer already. */
  const [tasksQ, guestsQ, paysQ, dayQ, inviteQ, contractQ] = await Promise.all([
    sb.from('tasks').select('id,client_id,title,due_on,done,owner').in('client_id', ids),
    sb.from('guests_rsvp').select('id,client_id,status').in('client_id', ids),
    sb.from('payments').select('id,client_id,amount,due_on,paid').in('client_id', ids),
    sb.from('day_schedule').select('id,client_id').in('client_id', ids),
    sb.from('client_authorized_emails').select('id,client_id,profile_id').in('client_id', ids),
    sb.from('contracts').select('id,client_id,signed_at').in('client_id', ids),
  ]);

  const tasks = tasksQ.data ?? [];
  const guests = guestsQ.data ?? [];
  const pays = paysQ.data ?? [];
  const day = dayQ.data ?? [];
  const invites = inviteQ.data ?? [];
  const contracts = contractQ.data ?? [];
  const mine = <T extends { client_id: string }>(rs: T[], id: string) => rs.filter((r) => r.client_id === id);

  return rows.map((r) => {
    const daysLeft = r.event_date ? daysUntil(r.event_date, today) : null;
    const passed = daysLeft !== null && daysLeft < 0;
    const needsClosing = passed && !r.archived_at;

    const myTasks = mine(tasks as { client_id: string; title: string; due_on: string | null; done: boolean; owner: string }[], r.id);
    const openTasks = myTasks.filter((t) => !t.done);
    const overdueTasks = openTasks.filter((t) => t.due_on && t.due_on < todayIso);

    const myGuests = mine(guests as { client_id: string; status: string }[], r.id);
    const attending = myGuests.filter((g) => g.status === 'attending').length;

    const myPays = mine(pays as { client_id: string; amount: number; due_on: string | null; paid: boolean }[], r.id);
    const unpaid = myPays.filter((p) => !p.paid);
    const owed = unpaid.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const overdue = unpaid
      .filter((p) => p.due_on && p.due_on < todayIso)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    const mySchedule = mine(day as { client_id: string }[], r.id);
    const myInvites = mine(invites as { client_id: string; profile_id: string | null }[], r.id);
    const myContracts = mine(contracts as { client_id: string; signed_at: string | null }[], r.id);

    const { gaps } = assess({
      hasDate: !!r.event_date,
      daysLeft,
      archived: !!r.archived_at,
      tasks: myTasks.length,
      overdueTasks: overdueTasks.length,
      guests: myGuests.length,
      scheduleItems: mySchedule.length,
      invites: myInvites.length,
      joinedInvites: myInvites.filter((i) => i.profile_id).length,
      overdueMoney: overdue,
      contracts: myContracts.length,
      signedContracts: myContracts.filter((x) => x.signed_at).length,
    });

    /* The nearest thing with a date wins; a task with no date is a someday, and
       showing it as "next" would be a small lie told on every row. */
    const dated = openTasks.filter((t) => t.due_on).sort((a, b) => (a.due_on! < b.due_on! ? -1 : 1));
    const nextTask = dated[0]
      ? { title: dated[0].title, dueOn: dated[0].due_on }
      : openTasks[0]
        ? { title: openTasks[0].title, dueOn: null }
        : null;

    return {
      id: r.id,
      name: r.display_name,
      kind: r.kind,
      eventDate: r.event_date,
      venue: r.venue,
      guestEstimate: r.guest_estimate,
      archivedAt: r.archived_at,
      daysLeft,
      gaps,
      nextTask,
      guests: { invited: myGuests.length, attending },
      money: { owed, overdue },
      needsClosing,
    };
  });
}
