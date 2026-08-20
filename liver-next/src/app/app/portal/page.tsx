import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { TaskList, type Task } from '@/components/app/TaskList';
import { PaymentsPanel, type Payment } from '@/components/app/PaymentsPanel';
import { BudgetPanel, type BudgetItem } from '@/components/app/BudgetPanel';
import { WinningBoard } from '@/components/app/WinningBoard';
import { signBoardImages } from '@/lib/board';

export const metadata = { title: appCopy.portal.title };

type Workspace = {
  id: string; display_name: string; event_date: string | null;
  venue: string; guest_estimate: number | null; budget_visible: boolean;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Whole days from today to the event, counted on calendar dates so a late
 *  evening visit does not shave a day off the countdown. */
function daysUntil(iso: string): number {
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(iso);
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export default async function PortalPage() {
  const account = await requireAccount();
  const sb = await supabaseServer();
  const { data } = await sb
    .from('clients')
    .select('id,display_name,event_date,venue,guest_estimate,budget_visible')
    .order('event_date', { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as Workspace[];

  /* One query for every workspace this couple is on, rather than one per
     card, so the page cost does not grow with the number of events. */
  const { data: allTasks } = rows.length
    ? await sb.from('tasks')
        .select('id,client_id,title,due_on,done,owner,created_by')
        .in('client_id', rows.map((r) => r.id))
        .order('done').order('due_on', { ascending: true, nullsFirst: false })
    : { data: [] };
  const tasksFor = (cid: string) =>
    ((allTasks ?? []) as (Task & { client_id: string })[]).filter((t) => t.client_id === cid);

  /* Budget rows simply do not arrive for a workspace the producer has not
     opened up, so there is nothing to hide in the page itself. */
  const ids = rows.map((r) => r.id);
  const [{ data: allPayments }, { data: allBudget }] = ids.length
    ? await Promise.all([
        sb.from('payments').select('id,client_id,title,amount,due_on,paid,paid_on').in('client_id', ids)
          .order('paid').order('due_on', { ascending: true, nullsFirst: false }),
        sb.from('budget_items').select('id,client_id,category,label,estimate,agreed,vendor').in('client_id', ids)
          .order('created_at'),
      ])
    : [{ data: [] }, { data: [] }];
  const paymentsFor = (cid: string) =>
    ((allPayments ?? []) as (Payment & { client_id: string })[]).filter((p) => p.client_id === cid);
  const budgetFor = (cid: string) =>
    ((allBudget ?? []) as (BudgetItem & { client_id: string })[]).filter((b) => b.client_id === cid);

  const { data: boardRows } = ids.length
    ? await sb.from('moodboards').select('id,client_id,category,caption,image_path')
        .in('client_id', ids).order('created_at', { ascending: false })
    : { data: [] };
  const board = await signBoardImages(sb, (boardRows ?? []) as never);
  const boardFor = (cid: string) => board.filter((b) => b.client_id === cid);
  if (rows.length === 0) {
    return (
      <>
        <PageHead title={appCopy.portal.title} sub={appCopy.portal.sub} />
        <Empty text={appCopy.portal.empty} />
      </>
    );
  }

  return (
    <>
      <PageHead title={appCopy.portal.title} sub={appCopy.portal.sub} />
      <div className="space-y-6">
        {rows.map((c) => {
          const left = c.event_date ? daysUntil(c.event_date) : null;
          return (
            <div key={c.id}>
            <article className="card">
              <h2 className="font-display text-[26px] font-semibold text-ink">{c.display_name}</h2>
              <p className="mt-2 text-[15.5px] text-ink-soft">
                {c.event_date ? dateFmt.format(new Date(c.event_date)) : appCopy.portal.dateTbd}
                {c.venue ? ` · ${c.venue}` : ''}
              </p>
              {left !== null && left >= 0 && (
                <div className="mt-6 flex items-baseline gap-2.5">
                  <span className="font-display text-[44px] font-semibold leading-none text-ink">{left}</span>
                  <span className="text-[15px] text-ink-mute">{appCopy.portal.daysLeft}</span>
                </div>
              )}
            </article>
            <div className="mt-4 space-y-6">
              <TaskList clientId={c.id} tasks={tasksFor(c.id)} viewer="client" viewerId={account.id} />
              <PaymentsPanel clientId={c.id} payments={paymentsFor(c.id)} viewer="client" />
              {budgetFor(c.id).length > 0 && (
                <BudgetPanel clientId={c.id} items={budgetFor(c.id)} viewer="client" visible />
              )}
              <WinningBoard clientId={c.id} images={boardFor(c.id)} viewer="client" />
            </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
