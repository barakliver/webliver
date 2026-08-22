import { appCopy } from '@/content/site';
import { formatDate, daysUntil } from '@/lib/dates';
import { TaskList } from '@/components/app/TaskList';
import { PaymentsPanel } from '@/components/app/PaymentsPanel';
import { BudgetPanel } from '@/components/app/BudgetPanel';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList } from '@/components/app/GuestList';
import { SeatingPlan } from '@/components/app/SeatingPlan';
import { DaySchedule } from '@/components/app/DaySchedule';
import type { PortalData, Workspace } from '@/lib/portal';

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/** One event, as the couple sees it.
 *
 *  This is the couple's screen and the producer's preview of it, the same
 *  component either way. A preview assembled from its own markup would drift
 *  from the real thing the first time one of them changed, and a preview that
 *  is only nearly right is worse than none: it invites decisions about what
 *  the couple can see, based on a screen they never saw. */
export function PortalWorkspace({
  workspace, data, viewerId,
}: { workspace: Workspace; data: PortalData; viewerId: string }) {
  const c = workspace;
  const left = daysUntil(c.event_date);
  const budget = data.budgetFor(c.id);

  return (
    <div>
      <article className="card">
        <h2 className="font-display text-[26px] font-semibold text-ink">{c.display_name}</h2>
        <p className="mt-2 text-[15.5px] text-ink-soft">
          {formatDate(dateFmt, c.event_date, appCopy.portal.dateTbd)}
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
        <TaskList clientId={c.id} tasks={data.tasksFor(c.id)} viewer="client" viewerId={viewerId} />
        <PaymentsPanel clientId={c.id} payments={data.paymentsFor(c.id)} viewer="client" />
        {budget.length > 0 && <BudgetPanel clientId={c.id} items={budget} viewer="client" visible />}
        <GuestList clientId={c.id} guests={data.guestsFor(c.id)} />
        <SeatingPlan clientId={c.id} tables={data.tablesFor(c.id)} guests={data.guestsFor(c.id) as never} />
        <DaySchedule
          clientId={c.id}
          items={data.dayFor(c.id)}
          labelA={c.track_a_label}
          labelB={c.track_b_label}
          viewer="client"
        />
        <WinningBoard clientId={c.id} images={data.boardFor(c.id)} viewer="client" />
      </div>
    </div>
  );
}
