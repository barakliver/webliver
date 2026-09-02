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
import type { Message as ThreadMessage } from '@/components/app/Thread';
import type { Contract as ContractRow } from '@/components/app/Contracts';

export type Workspace = {
  id: string; display_name: string; event_date: string | null;
  venue: string; guest_estimate: number | null; budget_visible: boolean;
  track_a_label: string; track_b_label: string;
  /** The guests' page: its address, and whether it is switched on. The
   *  couple gets the link to paste into their invitations; nothing else about
   *  the page is theirs to change from here. */
  guest_token: string | null; guest_site_on: boolean;
};

/** Which modules this workspace may open. Asked of the database rather than
 *  worked out here: the answer depends on the plan the workspace is on and on
 *  flags the platform owner controls, and neither belongs in a component. */
export type Gate = (clientId: string, key: string) => boolean;

export type PortalData = {
  workspaces: Workspace[];
  /** Never a reason to hide anything from the producer's own screens: the
   *  gate is about what a couple is sold, not about what a producer may use. */
  can: Gate;
  tasksFor: (id: string) => Task[];
  paymentsFor: (id: string) => Payment[];
  budgetFor: (id: string) => BudgetItem[];
  guestsFor: (id: string) => Guest[];
  tablesFor: (id: string) => SeatTable[];
  dayFor: (id: string) => DayItem[];
  boardFor: (id: string) => BoardImage[];
};

const WORKSPACE_COLS =
  'id,display_name,event_date,venue,guest_estimate,budget_visible,track_a_label,track_b_label,guest_token,guest_site_on';

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
    can: () => true,
    tasksFor: () => [], paymentsFor: () => [], budgetFor: () => [],
    guestsFor: () => [], tablesFor: () => [], dayFor: () => [], boardFor: () => [],
  };
  if (ids.length === 0) return empty;

  const [tasks, payments, budget, guests, tables, day, boardRows] = await Promise.all([
    sb.from('tasks').select('id,client_id,title,due_on,done,owner,created_by')
      .in('client_id', ids).order('done').order('sort_order')
      .order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('payments').select('id,client_id,title,amount,due_on,paid,paid_on')
      .in('client_id', ids).order('paid').order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('budget_items').select('id,client_id,category,label,estimate,agreed,vendor')
      .in('client_id', ids).order('created_at'),
    sb.from('guests_rsvp')
      .select('id,client_id,full_name,side,phone,status,party_size,diet,note,invite_token,table_id')
      .in('client_id', ids).order('full_name'),
    sb.from('tables_seating').select('id,client_id,name,seats').in('client_id', ids).order('created_at'),
    sb.from('day_schedule').select('id,client_id,track,at_time,title,note,owner,audience,duration_min').in('client_id', ids).order('at_time'),
    sb.from('moodboards').select('id,client_id,category,caption,image_path')
      .in('client_id', ids).order('created_at', { ascending: false }),
  ]);

  /* One row per workspace and module rather than a call per panel. A gate that
     costs a round trip is a gate somebody removes the first time a screen
     feels slow.

     Every module is open by default and stays open if the read fails. A
     platform outage must not silently take features away from a couple three
     days before their wedding: closing a door is a decision somebody made, and
     a failed query is not one. */
  const modules = ['budget', 'guests', 'seating', 'moodboard', 'runsheet', 'messages', 'files'];
  const closed = new Set<string>();
  await Promise.all(
    ids.flatMap((cid) =>
      modules.map(async (key) => {
        const { data, error } = await sb.rpc('feature_on', { p_client: cid, p_key: key });
        if (error) {
          console.error('[portal] gate failed', key, error);
          return;
        }
        if (data === false) closed.add(`${cid}:${key}`);
      }),
    ),
  );

  const board = await signBoardImages(sb, (boardRows.data ?? []) as never);

  /* The couple's view of money, applied here rather than in the markup, so no
     future screen can render these rows without going past the same gate. */
  const shared = new Set(workspaces.filter((w) => w.budget_visible).map((w) => w.id));
  const moneyVisible = (id: string) => !opts.asClient || shared.has(id);

  return {
    workspaces,
    tasksFor: (id) => by(tasks.data as WithClient<Task>[], id),
    paymentsFor: (id) => (moneyVisible(id) ? by(payments.data as WithClient<Payment>[], id) : []),
    can: (id, key) => !closed.has(`${id}:${key}`),
    budgetFor: (id) => (moneyVisible(id) ? by(budget.data as WithClient<BudgetItem>[], id) : []),
    guestsFor: (id) => by(guests.data as WithClient<Guest>[], id),
    tablesFor: (id) => by(tables.data as WithClient<SeatTable>[], id),
    dayFor: (id) => by(day.data as WithClient<DayItem>[], id),
    boardFor: (id) => by(board as WithClient<BoardImage>[], id),
  };
}

/** The thread for one or more workspaces, with each author's name and face.
 *
 *  Authors are joined in the query rather than fetched per message: a thread
 *  of two hundred lines between three people is three profiles, and asking for
 *  them one at a time is two hundred round trips to learn the same fact. */
export async function loadThread(
  sb: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, ThreadMessage[]>> {
  const byClient = new Map<string, ThreadMessage[]>();
  if (clientIds.length === 0) return byClient;

  const { data } = await sb
    .from('messages')
    .select('id,client_id,author_id,body,created_at')
    .in('client_id', clientIds)
    .order('created_at', { ascending: true })
    .limit(500);

  const rows = data ?? [];

  /* Names and faces come from thread_people(), not from profiles. profiles is
     self-read only — correctly, since it carries the email address and the
     role — so reading it here would sign every one of the producer's messages
     "—" on the couple's screen. The function returns a display name and a
     picture for the people on a workspace you can already read, and nothing
     else about them. */
  const who = new Map<string, { name: string; avatar: string | null }>();
  await Promise.all(
    clientIds.map(async (cid) => {
      const { data: people } = await sb.rpc('thread_people', { p_client: cid });
      (people ?? []).forEach((p: { id: string; display_name: string; avatar_url: string | null }) => {
        if (!who.has(p.id)) who.set(p.id, { name: p.display_name || '·', avatar: p.avatar_url });
      });
    })
  );

  for (const m of rows) {
    const person = who.get(m.author_id);
    const list = byClient.get(m.client_id) ?? [];
    list.push({
      id: m.id,
      author_id: m.author_id,
      body: m.body,
      created_at: m.created_at,
      author_name: person?.name ?? '·',
      author_avatar: person?.avatar ?? null,
    });
    byClient.set(m.client_id, list);
  }
  return byClient;
}

/** Contracts for one or more workspaces, with signed links and an integrity
 *  answer per row.
 *
 *  The intact check is asked of the database rather than recomputed here: the
 *  digest is defined in one place, and a second implementation in TypeScript
 *  would eventually disagree with it — at which point the screen would either
 *  cry tampering over a whitespace difference or, far worse, stay quiet about
 *  a real one. */
export async function loadContracts(
  sb: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, ContractRow[]>> {
  const byClient = new Map<string, ContractRow[]>();
  if (clientIds.length === 0) return byClient;

  const { data } = await sb
    .from('contracts')
    .select('id,client_id,title,body,file_path,amount,status,signed_at,signed_name,party_name,party_role')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false });

  const rows = data ?? [];
  if (rows.length === 0) return byClient;

  const [signedUrls, intacts] = await Promise.all([
    (async () => {
      const paths = rows.map((r) => r.file_path).filter((p): p is string => !!p);
      if (paths.length === 0) return new Map<string, string>();
      const { data: urls } = await sb.storage.from('contracts').createSignedUrls(paths, 60 * 30);
      return new Map((urls ?? []).filter((u) => u.signedUrl && u.path).map((u) => [u.path!, u.signedUrl!]));
    })(),
    (async () => {
      const answers = await Promise.all(
        rows.map(async (r) => {
          if (r.status !== 'signed') return [r.id, true] as const;
          const { data: ok } = await sb.rpc('contract_intact', { p_contract: r.id });
          /* A check that could not run is not a pass. */
          return [r.id, ok === true] as const;
        })
      );
      return new Map(answers);
    })(),
  ]);

  for (const r of rows) {
    const list = byClient.get(r.client_id) ?? [];
    list.push({
      id: r.id,
      title: r.title,
      body: r.body,
      file_path: r.file_path,
      amount: r.amount === null ? null : Number(r.amount),
      status: r.status,
      signed_at: r.signed_at,
      signed_name: r.signed_name,
      intact: intacts.get(r.id) ?? true,
      file_url: r.file_path ? (signedUrls.get(r.file_path) ?? null) : null,
    });
    byClient.set(r.client_id, list);
  }
  return byClient;
}
