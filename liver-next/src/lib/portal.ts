import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task } from '@/components/app/TaskList';
import type { Payment } from '@/components/app/PaymentsPanel';
import type { BudgetItem } from '@/components/app/BudgetPanel';
import type { Guest } from '@/components/app/GuestList';
import type { SeatTable } from '@/components/app/SeatingPlan';
import type { DayItem } from '@/components/app/DaySchedule';
import type { BoardImage } from '@/components/app/WinningBoard';
import { signBoardImages } from '@/lib/board';

export type Workspace = {
  id: string; display_name: string; event_date: string | null;
  venue: string; guest_estimate: number | null; budget_visible: boolean;
  track_a_label: string; track_b_label: string;
};

export type PortalData = {
  workspaces: Workspace[];
  tasksFor: (id: string) => Task[];
  paymentsFor: (id: string) => Payment[];
  budgetFor: (id: string) => BudgetItem[];
  guestsFor: (id: string) => Guest[];
  tablesFor: (id: string) => SeatTable[];
  dayFor: (id: string) => DayItem[];
  boardFor: (id: string) => BoardImage[];
};

const WORKSPACE_COLS =
  'id,display_name,event_date,venue,guest_estimate,budget_visible,track_a_label,track_b_label';

type WithClient<T> = T & { client_id: string };
const by = <T,>(rows: WithClient<T>[] | null | undefined, id: string): T[] =>
  (rows ?? []).filter((r) => r.client_id === id);

/**
 * Everything the couple's portal is made of, for one workspace or for all of
 * them, in a fixed number of queries rather than one per card.
 *
 * `asClient` is the whole point of this function existing separately from the
 * page. A producer previewing the portal reads through their own policies,
 * which are wider than the couple's: money is the one place the two disagree,
 * because budget_items and payments are gated on clients.budget_visible for a
 * couple and not gated at all for the producer who owns the workspace. Left
 * alone, a preview would show the producer their own numbers and quietly
 * report that the couple can see them too — which is exactly the question the
 * preview exists to answer, answered wrongly.
 *
 * So when reading on the couple's behalf, money is dropped for any workspace
 * the producer has not opened up. The gate is the same column the policy
 * checks, so the two cannot drift apart without the policy changing too.
 */
export async function loadPortal(
  sb: SupabaseClient,
  opts: { clientId?: string; asClient: boolean }
): Promise<PortalData> {
  let q = sb.from('clients').select(WORKSPACE_COLS);
  if (opts.clientId) q = q.eq('id', opts.clientId);
  const { data } = await q.order('event_date', { ascending: true, nullsFirst: false });

  const workspaces = (data ?? []) as Workspace[];
  const ids = workspaces.map((w) => w.id);

  const empty: PortalData = {
    workspaces,
    tasksFor: () => [], paymentsFor: () => [], budgetFor: () => [],
    guestsFor: () => [], tablesFor: () => [], dayFor: () => [], boardFor: () => [],
  };
  if (ids.length === 0) return empty;

  const [tasks, payments, budget, guests, tables, day, boardRows] = await Promise.all([
    sb.from('tasks').select('id,client_id,title,due_on,done,owner,created_by')
      .in('client_id', ids).order('done').order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('payments').select('id,client_id,title,amount,due_on,paid,paid_on')
      .in('client_id', ids).order('paid').order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('budget_items').select('id,client_id,category,label,estimate,agreed,vendor')
      .in('client_id', ids).order('created_at'),
    sb.from('guests_rsvp')
      .select('id,client_id,full_name,side,phone,status,party_size,diet,note,invite_token,table_id')
      .in('client_id', ids).order('full_name'),
    sb.from('tables_seating').select('id,client_id,name,seats').in('client_id', ids).order('created_at'),
    sb.from('day_schedule').select('id,client_id,track,at_time,title,note').in('client_id', ids).order('at_time'),
    sb.from('moodboards').select('id,client_id,category,caption,image_path')
      .in('client_id', ids).order('created_at', { ascending: false }),
  ]);

  const board = await signBoardImages(sb, (boardRows.data ?? []) as never);

  /* The couple's view of money, applied here rather than in the markup, so no
     future screen can render these rows without going past the same gate. */
  const shared = new Set(workspaces.filter((w) => w.budget_visible).map((w) => w.id));
  const moneyVisible = (id: string) => !opts.asClient || shared.has(id);

  return {
    workspaces,
    tasksFor: (id) => by(tasks.data as WithClient<Task>[], id),
    paymentsFor: (id) => (moneyVisible(id) ? by(payments.data as WithClient<Payment>[], id) : []),
    budgetFor: (id) => (moneyVisible(id) ? by(budget.data as WithClient<BudgetItem>[], id) : []),
    guestsFor: (id) => by(guests.data as WithClient<Guest>[], id),
    tablesFor: (id) => by(tables.data as WithClient<SeatTable>[], id),
    dayFor: (id) => by(day.data as WithClient<DayItem>[], id),
    boardFor: (id) => by(board as WithClient<BoardImage>[], id),
  };
}
