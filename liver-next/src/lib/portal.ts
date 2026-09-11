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
import { readShares, sectionOpen, type SharedSections } from '@/content/portalSections';
import { readPlan, type BudgetPlan } from '@/lib/budgetPlan';

export type Workspace = {
  id: string; display_name: string; event_date: string | null;
  venue: string; guest_estimate: number | null; budget_visible: boolean;
  /** Roughly where, in the couple's words. Distinct from venue, which is one
   *  hall by name. Empty until somebody says. */
  region: string;
  budget_target: number | null;
  /** The doors the producer has closed on the couple's screen. Empty means
   *  all open. */
  shared_sections: SharedSections;
  /** The intended split, or null until the planner was used. */
  budget_plan: BudgetPlan | null;
  /** The wedding's brand as the column holds it; read where it is drawn. */
  brand: unknown;
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

/** One celebration inside a workspace. A couple with a henna and a wedding
 *  has two of these, each with its own date, place and checklist. */
export type PortalEvent = {
  id: string;
  client_id: string;
  event_type: string;
  display_name: string;
  event_date: string | null;
  location: string;
};

/** A supplier on the event, as the couple sees it: the same event_vendors row
 *  the producer's suppliers tab shows, read under the couple's own policy. */
export type Vendor = {
  id: string;
  client_id: string;
  name: string;
  category: string;
  phone: string;
  status: string;
  notes: string;
  /* The relationship's status, for the couple's copy of the supplier HQ. */
  deposit: number | null;
  deposit_paid_on: string | null;
  balance_due_on: string | null;
  last_contact_on: string | null;
  waiting_on: 'me' | 'them' | null;
  next_action: string;
};

/** A meeting the producer shared with the couple. Only rows with
 *  visible_to_client are ever read here, whichever side is reading, so the
 *  producer's preview shows exactly what the couple would see. */
export type SharedMeeting = {
  id: string;
  client_id: string;
  kind: string;
  title: string;
  held_on: string | null;
  summary: string;
};

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
  vendorsFor: (id: string) => Vendor[];
  /** The meetings the producer chose to share, newest first. */
  meetingsFor: (id: string) => SharedMeeting[];
  /** In date order, soonest first. Read on the server so the selector does not
   *  have to fetch its own rows and flash a skeleton on every visit. */
  eventsFor: (id: string) => PortalEvent[];
};

const WORKSPACE_COLS =
  'id,display_name,event_date,venue,guest_estimate,region,budget_visible,budget_target,shared_sections,budget_plan,track_a_label,track_b_label,guest_token,guest_site_on,brand';

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

  const workspaces = ((data ?? []) as Workspace[]).map((w) => ({ ...w, shared_sections: readShares(w.shared_sections), budget_plan: readPlan(w.budget_plan) }));
  const ids = workspaces.map((w) => w.id);

  const empty: PortalData = {
    workspaces,
    can: () => true,
    tasksFor: () => [], paymentsFor: () => [], budgetFor: () => [],
    guestsFor: () => [], tablesFor: () => [], dayFor: () => [], boardFor: () => [],
    vendorsFor: () => [], meetingsFor: () => [], eventsFor: () => [],
  };
  if (ids.length === 0) return empty;

  /* The celebrations themselves. Read whole rather than by id alone: the
     selector above the checklist needs the name and the date, and the page
     needs to know which of them a `?event=` in the address actually refers to
     before it trusts it. */
  const { data: eventsData } = await sb
    .from('events')
    .select('id,client_id,event_type,display_name,event_date,location')
    .in('client_id', ids)
    .order('event_date', { ascending: true, nullsFirst: false });

  const events = (eventsData ?? []) as PortalEvent[];

  const [tasks, payments, budget, guests, tables, day, boardRows, vendorRows, meetingRows] = await Promise.all([
    sb.from('tasks').select('id,client_id,title,due_on,done,owner,created_by,event_id,category,vendor_id')
      .in('client_id', ids).order('done').order('sort_order')
      .order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('payments').select('id,client_id,title,amount,due_on,paid,paid_on')
      .in('client_id', ids).order('paid').order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('budget_items').select('id,client_id,category,label,estimate,agreed,vendor,event_vendor_id,created_at')
      .in('client_id', ids).order('created_at'),
    sb.from('guests_rsvp')
      .select('id,client_id,full_name,side,phone,status,party_size,diet,note,invite_token,table_id')
      .in('client_id', ids).order('full_name'),
    sb.from('tables_seating').select('id,client_id,name,seats').in('client_id', ids).order('created_at'),
    sb.from('day_schedule').select('id,client_id,track,at_time,title,note,owner,audience,duration_min').in('client_id', ids).order('at_time'),
    sb.from('moodboards').select('id,client_id,category,caption,image_path')
      .in('client_id', ids).order('created_at', { ascending: false }),
    sb.from('event_vendors').select('id,client_id,name,category,phone,status,notes,deposit,deposit_paid_on,balance_due_on,last_contact_on,waiting_on,next_action')
      .in('client_id', ids).order('category').order('name'),
    /* Shared ones only, on both sides. The couple's policy already refuses
       the rest; filtering here too is what makes the producer's preview
       honest, since their own policy would hand them everything. */
    sb.from('meeting_logs').select('id,client_id,kind,title,held_on,summary')
      .in('client_id', ids).eq('visible_to_client', true)
      .order('held_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
  ]);

  /* One row per workspace and module rather than a call per panel. A gate that
     costs a round trip is a gate somebody removes the first time a screen
     feels slow.

     Every module is open by default and stays open if the read fails. A
     platform outage must not silently take features away from a couple three
     days before their wedding: closing a door is a decision somebody made, and
     a failed query is not one. */
  const modules = ['budget', 'guests', 'seating', 'moodboard', 'runsheet', 'messages', 'files', 'prep', 'venues', 'events', 'envelopes', 'transport', 'meetings'];
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

  /* The producer's own switches, read on the couple's behalf only. Two
     things close a door: the plan, above, and the producer, here. Money's
     door is its own column, so 'budget' answers from that one. A producer
     reading their own event through this gate is never refused. */
  const byId = new Map(workspaces.map((w) => [w.id, w]));
  const producerOpened = (id: string, key: string) => {
    if (!opts.asClient) return true;
    const w = byId.get(id);
    if (!w) return true;
    return key === 'budget' ? w.budget_visible : sectionOpen(w.shared_sections, key);
  };

  return {
    workspaces,
    tasksFor: (id) => by(tasks.data as WithClient<Task>[], id),
    paymentsFor: (id) => (moneyVisible(id) ? by(payments.data as WithClient<Payment>[], id) : []),
    can: (id, key) => !closed.has(`${id}:${key}`) && producerOpened(id, key),
    budgetFor: (id) => (moneyVisible(id) ? by(budget.data as WithClient<BudgetItem>[], id) : []),
    guestsFor: (id) => by(guests.data as WithClient<Guest>[], id),
    tablesFor: (id) => by(tables.data as WithClient<SeatTable>[], id),
    dayFor: (id) => by(day.data as WithClient<DayItem>[], id),
    boardFor: (id) => by(board as WithClient<BoardImage>[], id),
    vendorsFor: (id) => by(vendorRows.data as WithClient<Vendor>[], id),
    meetingsFor: (id) => by(meetingRows.data as WithClient<SharedMeeting>[], id),
    eventsFor: (id) => events.filter((e) => e.client_id === id),
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
      party_name: r.party_name ?? '',
      intact: intacts.get(r.id) ?? true,
      file_url: r.file_path ? (signedUrls.get(r.file_path) ?? null) : null,
    });
    byClient.set(r.client_id, list);
  }
  return byClient;
}
