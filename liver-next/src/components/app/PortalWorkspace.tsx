import type { AppUi } from '@/content/appUi';
import { weekdayDate } from '@/lib/appDates';
import { formatDate, daysUntil } from '@/lib/dates';
import { TaskList } from '@/components/app/TaskList';
import { PaymentsPanel } from '@/components/app/PaymentsPanel';
import { BudgetPanel } from '@/components/app/BudgetPanel';
import { FinanceSummary } from '@/components/app/FinanceSummary';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList } from '@/components/app/GuestList';
import { SeatingPlan } from '@/components/app/SeatingPlan';
import { DaySchedule } from '@/components/app/DaySchedule';
import { PortalSummary, summaryRows } from '@/components/app/PortalSummary';
import { GuestSiteLink } from '@/components/app/GuestSiteLink';
import { PortalVendors } from '@/components/app/PortalVendors';
import { Ltr } from '@/components/Ltr';
import type { PortalData, Workspace } from '@/lib/portal';

/** Counts the page loads beside this component rather than inside it —
 *  contracts, halls, files and the two night-of lists — so the summary strip
 *  can point at every section without this component fetching six more
 *  things. Absent means zero, which is what a preview with no rows has. */
export type PortalExtra = { contracts: number; venues: number; files: number; envelopes: number; vehicles: number };
const NO_EXTRA: PortalExtra = { contracts: 0, venues: 0, files: 0, envelopes: 0, vehicles: 0 };

/** One event, as the couple sees it.
 *
 *  This is the couple's screen and the producer's preview of it, the same
 *  component either way. A preview assembled from its own markup would drift
 *  from the real thing the first time one of them changed, and a preview that
 *  is only nearly right is worse than none: it invites decisions about what
 *  the couple can see, based on a screen they never saw. */
export function PortalWorkspace({
  workspace, data, viewerId, ui, currentEventId, extra = NO_EXTRA,
}: { workspace: Workspace; data: PortalData; viewerId: string; ui: AppUi; currentEventId?: string; extra?: PortalExtra }) {
  const c = workspace;
  const dateFmt = weekdayDate(ui.locale);
  const left = daysUntil(c.event_date);
  const budget = data.budgetFor(c.id);
  const guests = data.guestsFor(c.id);

  /* Counted here rather than asked of the database again: every one of these
     lists is already in memory for the panels below, and a second query per
     row is how a summary becomes the slowest thing on its own screen. */
  const attending = guests.filter((g) => g.status === 'attending').length;
  const agreed = budget.reduce((sum, b) => sum + (Number(b.agreed ?? b.estimate) || 0), 0);
  const payments = data.paymentsFor(c.id);
  const owed = payments.filter((p) => !p.paid).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  /* Filter tasks by event if currentEventId is set */
  const allTasks = data.tasksFor(c.id);
  const filteredTasks = currentEventId
    ? allTasks.filter((t) => t.event_id === currentEventId)
    : allTasks;

  return (
    <div>
      {/* The names in serif over the image, then the count. The countdown is
          the largest thing on the couple's screen on purpose: it is the one
          number they open the app to see, and every other figure on the page
          is a consequence of it. */}
      <header>
        <p className="text-[12px] tracking-[.14em] text-ink-mute">
          {formatDate(dateFmt, c.event_date, ui.portal.dateTbd)}
          {c.venue ? ` · ${c.venue}` : ''}
        </p>

        <h2 className="mt-3 font-display text-display font-semibold leading-tight text-ink">
          {c.display_name}
        </h2>

        {left !== null && left >= 0 && (
          <div className="mt-8">
            <p className="font-display text-[72px] font-semibold leading-none text-ink sm:text-[104px]">
              <Ltr>{left.toLocaleString('en-US')}</Ltr>
            </p>
            <p className="mt-2 text-[14px] text-ink-mute">{ui.portal.daysLeft}</p>
          </div>
        )}

        <hr className="rule-gold mt-8" />
      </header>

      <PortalSummary
        rows={summaryRows({
          budget: agreed > 0 ? agreed : null,
          owed,
          openTasks: filteredTasks.filter((t) => !t.done).length,
          attending,
          invited: guests.length,
          tables: data.tablesFor(c.id).length,
          saved: data.boardFor(c.id).length,
          vendors: data.vendorsFor(c.id).length,
          ...extra,
          can: (key) => data.can(c.id, key as never),
          c: ui.portal,
        })}
        label={ui.portal.summary}
      />

      <div className="mt-10 space-y-10">
        {/* The link they paste into the family group, once the producer has
            switched the page on. Above the tasks because sending it is
            usually the first thing the couple wants to do. */}
        {c.guest_site_on && c.guest_token && <GuestSiteLink token={c.guest_token} />}
        <div id="tasks"><TaskList clientId={c.id} tasks={filteredTasks} viewer="client" viewerId={viewerId} /></div>
        {/* The working shown before the lists, and only once there is a
            budget to show: without lines the five figures are five zeros. */}
        {data.can(c.id, 'budget') && budget.length > 0 && (
          <FinanceSummary
            clientId={c.id} viewer="client"
            target={c.budget_target === null || c.budget_target === undefined ? null : Number(c.budget_target)}
            items={budget} payments={data.paymentsFor(c.id)}
          />
        )}
        <div id="payments"><PaymentsPanel clientId={c.id} payments={payments} viewer="client" /></div>
        {/* Gated modules. A closed one is absent rather than greyed out: a
            locked panel advertising something the couple was not sold is a
            sales screen wearing the clothes of a tool. */}
        {data.can(c.id, 'budget') && (
          <div id="budget"><BudgetPanel clientId={c.id} items={budget} viewer="client" visible /></div>
        )}
        {data.can(c.id, 'guests') && (
          <div id="guests"><GuestList clientId={c.id} guests={guests} /></div>
        )}
        {data.can(c.id, 'seating') && (
          <div id="seating"><SeatingPlan clientId={c.id} tables={data.tablesFor(c.id)} guests={data.guestsFor(c.id) as never} /></div>
        )}
        {/* Who is hired. The same rows the producer's suppliers tab shows,
            and where a DJ ticked off the checklist above turns up. */}
        <div id="vendors"><PortalVendors vendors={data.vendorsFor(c.id)} c={ui.portal} locale={ui.locale} /></div>
        {data.can(c.id, 'runsheet') && (
          <div id="runsheet"><DaySchedule
            clientId={c.id}
            items={data.dayFor(c.id)}
            labelA={c.track_a_label}
            labelB={c.track_b_label}
            viewer="client"
          /></div>
        )}
        {data.can(c.id, 'moodboard') && (
          <div id="board"><WinningBoard clientId={c.id} images={data.boardFor(c.id)} viewer="client" /></div>
        )}
      </div>
    </div>
  );
}
