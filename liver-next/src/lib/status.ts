import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

/* ── The state of every event, in one place ────────────────────────────────
   The clients list showed a name, a date, a venue and a guest count. All true,
   none of it the thing a producer opens the screen to find out, which is:
   which of these needs me, and what is missing.

   So each event carries its gaps. A gap is something that should exist by now
   and does not, judged against how close the event is — an empty guest list is
   nothing at ten months out and a problem at six weeks. Every gap names one
   specific missing thing, because "incomplete" is a feeling and "no run sheet,
   three weeks out" is a job.                                                  */

export type GapLevel = 'now' | 'soon';

export type Gap = {
  code: string;
  label: string;
  level: GapLevel;
};

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

/* Thresholds, named rather than sprinkled through the checks. These are the
   points at which a missing thing stops being early and starts being late. */
const NEEDS_TASKS_WITHIN = 120;
const NEEDS_GUESTS_WITHIN = 90;
const NEEDS_SCHEDULE_WITHIN = 30;

/** What one event is missing, given plain facts about it.
 *
 *  Pure on purpose. These rules are the judgement the board exists to make —
 *  when an empty guest list stops being early and starts being late — and
 *  judgement that can only be exercised by standing up a database, a producer
 *  and six tables is judgement nobody checks. Everything here is arithmetic on
 *  numbers, so it can be. */
export function assess(f: {
  hasDate: boolean;
  daysLeft: number | null;
  archived: boolean;
  tasks: number;
  overdueTasks: number;
  guests: number;
  scheduleItems: number;
  invites: number;
  joinedInvites: number;
  overdueMoney: number;
}): { gaps: Gap[]; needsClosing: boolean } {
  const passed = f.daysLeft !== null && f.daysLeft < 0;
  const needsClosing = passed && !f.archived;
  const within = (d: number) => f.daysLeft !== null && f.daysLeft >= 0 && f.daysLeft <= d;

  const gaps: Gap[] = [];

  /* Ordered by what it costs to ignore, because the first chip is the one that
     gets read. */
  if (needsClosing) gaps.push({ code: 'closing', label: 'האירוע עבר — לסגור תיק', level: 'now' });
  if (f.overdueTasks > 0) {
    gaps.push({
      code: 'task_overdue',
      label: f.overdueTasks === 1 ? 'משימה באיחור' : `${f.overdueTasks} משימות באיחור`,
      level: 'now',
    });
  }
  if (f.overdueMoney > 0) gaps.push({ code: 'pay_overdue', label: 'תשלום באיחור', level: 'now' });
  if (!f.hasDate) gaps.push({ code: 'no_date', label: 'אין תאריך', level: 'soon' });

  if (f.invites === 0) {
    /* Before the event this is the thing blocking everything else — the couple
       cannot do their half of the work. Afterwards it is only untidy. */
    gaps.push({ code: 'no_couple', label: 'הזוג עוד לא צורף', level: passed ? 'soon' : 'now' });
  } else if (f.joinedInvites === 0) {
    gaps.push({ code: 'not_joined', label: 'הזוג עוד לא נכנס', level: 'soon' });
  }

  if (!passed && f.tasks === 0 && (within(NEEDS_TASKS_WITHIN) || !f.hasDate)) {
    gaps.push({ code: 'no_tasks', label: 'אין משימות', level: 'soon' });
  }
  if (!passed && f.guests === 0 && within(NEEDS_GUESTS_WITHIN)) {
    gaps.push({ code: 'no_guests', label: 'אין רשימת אורחים', level: within(45) ? 'now' : 'soon' });
  }
  if (!passed && f.scheduleItems === 0 && within(NEEDS_SCHEDULE_WITHIN)) {
    gaps.push({ code: 'no_schedule', label: 'אין לוז ליום האירוע', level: 'now' });
  }

  return { gaps, needsClosing };
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

  /* Five queries for the whole board rather than five per event. Row level
     security scopes each one to this producer already. */
  const [tasksQ, guestsQ, paysQ, dayQ, inviteQ] = await Promise.all([
    sb.from('tasks').select('id,client_id,title,due_on,done,owner').in('client_id', ids),
    sb.from('guests_rsvp').select('id,client_id,status').in('client_id', ids),
    sb.from('payments').select('id,client_id,amount,due_on,paid').in('client_id', ids),
    sb.from('day_schedule').select('id,client_id').in('client_id', ids),
    sb.from('client_authorized_emails').select('id,client_id,profile_id').in('client_id', ids),
  ]);

  const tasks = tasksQ.data ?? [];
  const guests = guestsQ.data ?? [];
  const pays = paysQ.data ?? [];
  const day = dayQ.data ?? [];
  const invites = inviteQ.data ?? [];
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
