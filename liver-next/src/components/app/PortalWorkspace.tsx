import type { AppUi } from '@/content/appUi';
import { weekdayDate } from '@/lib/appDates';
import { formatDate, daysUntil } from '@/lib/dates';
import { TaskList } from '@/components/app/TaskList';
import { PaymentsPanel } from '@/components/app/PaymentsPanel';
import { BudgetPanel } from '@/components/app/BudgetPanel';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList } from '@/components/app/GuestList';
import { SeatingPlan } from '@/components/app/SeatingPlan';
import { DaySchedule } from '@/components/app/DaySchedule';
import { PortalSummary, summaryRows } from '@/components/app/PortalSummary';
import { GuestSiteLink } from '@/components/app/GuestSiteLink';
import { Ltr } from '@/components/Ltr';
import type { PortalData, Workspace } from '@/lib/portal';

/** One event, as the couple sees it.
 *
 *  This is the couple's screen and the producer's preview of it, the same
 *  component either way. A preview assembled from its own markup would drift
 *  from the real thing the first time one of them changed, and a preview that
 *  is only nearly right is worse than none: it invites decisions about what
 *  the couple can see, based on a screen they never saw. */
export function PortalWorkspace({
  workspace, data, viewerId, ui,
}: { workspace: Workspace; data: PortalData; viewerId: string; ui: AppUi }) {
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

        <h2 className="mt-3 font-display text-display font-light leading-tight text-ink">
          {c.display_name}
        </h2>

        {left !== null && left >= 0 && (
          <div className="mt-8">
            <p className="font-display text-[72px] font-light leading-none text-ink sm:text-[104px]">
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
          attending,
          invited: guests.length,
          saved: data.boardFor(c.id).length,
          vendors: data.dayFor(c.id).length,
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
        <TaskList clientId={c.id} tasks={data.tasksFor(c.id)} viewer="client" viewerId={viewerId} />
        <PaymentsPanel clientId={c.id} payments={data.paymentsFor(c.id)} viewer="client" />
        {/* Gated modules. A closed one is absent rather than greyed out: a
            locked panel advertising something the couple was not sold is a
            sales screen wearing the clothes of a tool. */}
        {data.can(c.id, 'budget') && budget.length > 0 && (
          <div id="budget"><BudgetPanel clientId={c.id} items={budget} viewer="client" visible /></div>
        )}
        {data.can(c.id, 'guests') && (
          <div id="guests"><GuestList clientId={c.id} guests={guests} /></div>
        )}
        {data.can(c.id, 'seating') && (
          <SeatingPlan clientId={c.id} tables={data.tablesFor(c.id)} guests={data.guestsFor(c.id) as never} />
        )}
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
