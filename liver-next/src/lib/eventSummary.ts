import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows } from '@/lib/safe';
import { isOverdue } from '@/lib/dates';

/**
 * The event in numbers, for the top of its file.
 *
 * Every figure here answers a question a producer asks out loud before opening
 * anything else: how many are actually coming, how much is still out, what is
 * late. Nothing is counted that nobody asks about — a tile with a number
 * nobody needs teaches people to stop reading the tiles.
 *
 * Each read is contained on its own. A summary is the least important thing on
 * the page to get completely right and the worst thing to have take the page
 * down with it, so a panel that fails comes back as a dash.
 */

export type EventSummary = {
  guests: { total: number; confirmed: number; pending: number; declined: number; seats: number };
  money: { paid: number; owed: number; overdue: number };
  tasksOpen: number;
  dayLines: number;
  contracts: { total: number; signed: number };
  /** The soonest handful of things still waiting, whatever kind they are. */
  next: { id: string; kind: 'task' | 'payment'; title: string; due: string | null; amount?: number }[];
};

type GuestRow = { status: string; party_size: number | null };
type PaymentRow = { id: string; title: string; amount: number | null; due_on: string | null; paid: boolean };
type TaskRow = { id: string; title: string; due_on: string | null; done: boolean };

export async function loadEventSummary(
  sb: SupabaseClient,
  clientId: string
): Promise<EventSummary> {
  const [guestRows, paymentRows, taskRows, dayRows, contractRows] = await Promise.all([
    safeRows<GuestRow>('summary guests', sb.from('guests_rsvp')
      .select('status,party_size').eq('client_id', clientId)),
    safeRows<PaymentRow>('summary payments', sb.from('payments')
      .select('id,title,amount,due_on,paid').eq('client_id', clientId)),
    safeRows<TaskRow>('summary tasks', sb.from('tasks')
      .select('id,title,due_on,done').eq('client_id', clientId)),
    safeRows<{ id: string }>('summary schedule', sb.from('day_schedule')
      .select('id').eq('client_id', clientId)),
    safeRows<{ id: string; signed_at: string | null }>('summary contracts', sb.from('contracts')
      .select('id,signed_at').eq('client_id', clientId)),
  ]);

  const guests = {
    total: guestRows.length,
    confirmed: guestRows.filter((g) => g.status === 'attending').length,
    pending: guestRows.filter((g) => g.status === 'pending').length,
    declined: guestRows.filter((g) => g.status === 'declined').length,
    /* Seats rather than names. Twelve invitations can be thirty people, and
       thirty is the number the caterer and the seating plan need. Only those
       who said yes are counted: an unanswered invitation is not a chair. */
    seats: guestRows
      .filter((g) => g.status === 'attending')
      .reduce((sum, g) => sum + (g.party_size ?? 1), 0),
  };

  const money = {
    paid: paymentRows.filter((p) => p.paid).reduce((s, p) => s + (p.amount ?? 0), 0),
    owed: paymentRows.filter((p) => !p.paid).reduce((s, p) => s + (p.amount ?? 0), 0),
    overdue: paymentRows
      .filter((p) => !p.paid && isOverdue(p.due_on))
      .reduce((s, p) => s + (p.amount ?? 0), 0),
  };

  const openTasks = taskRows.filter((t) => !t.done);
  const openPayments = paymentRows.filter((p) => !p.paid);

  /* One list, both kinds, soonest first. A producer's next move is whichever
     is nearest, and splitting them into two lists puts that decision back on
     the person reading. Undated goes last: it is waiting, not urgent. */
  const next = [
    ...openTasks.map((t) => ({ id: t.id, kind: 'task' as const, title: t.title, due: t.due_on })),
    ...openPayments.map((p) => ({
      id: p.id, kind: 'payment' as const, title: p.title, due: p.due_on, amount: p.amount ?? 0,
    })),
  ]
    .sort((a, b) => {
      if (a.due === b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    })
    .slice(0, 5);

  return {
    guests,
    money,
    tasksOpen: openTasks.length,
    dayLines: dayRows.length,
    contracts: {
      total: contractRows.length,
      signed: contractRows.filter((c) => c.signed_at).length,
    },
    next,
  };
}
