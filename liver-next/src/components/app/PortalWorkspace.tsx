import type { AppUi } from '@/content/appUi';
import { weekdayDate } from '@/lib/appDates';
import { formatDate, daysUntil } from '@/lib/dates';
import { TaskList } from '@/components/app/TaskList';
import { WeddingBingo } from '@/components/app/WeddingBingo';
import { PaymentsPanel } from '@/components/app/PaymentsPanel';
import { BudgetPanel } from '@/components/app/BudgetPanel';
import { BudgetTracker } from '@/components/app/BudgetTracker';
import { FinanceSummary } from '@/components/app/FinanceSummary';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList } from '@/components/app/GuestList';
import { SeatingPlan } from '@/components/app/SeatingPlan';
import { DaySchedule } from '@/components/app/DaySchedule';
import { PortalSummary, summaryRows } from '@/components/app/PortalSummary';
import { NextAction } from '@/components/app/NextAction';
import { BeginFlow } from '@/components/app/BeginFlow';
import { GuestSiteLink } from '@/components/app/GuestSiteLink';
import { PortalVendors } from '@/components/app/PortalVendors';
import { PortalMeetings } from '@/components/app/PortalMeetings';
import { QuoteCompare } from '@/components/app/QuoteCompare';
import { Fold } from '@/components/Fold';
import { Ltr } from '@/components/Ltr';
import type { PortalData, Workspace } from '@/lib/portal';
import { nextAction, upcoming, type TaskFact } from '@/lib/nextAction';
import { track } from '@/lib/budgetPlan';
import { todayInZone } from '@/lib/clock';

/** Counts the page loads beside this component rather than inside it —
 *  contracts, halls, files and the two night-of lists — so the summary strip
 *  can point at every section without this component fetching six more
 *  things. Absent means zero, which is what a preview with no rows has. */
export type PortalExtra = { contracts: number; venues: number; files: number; envelopes: number; vehicles: number };
const NO_EXTRA: PortalExtra = { contracts: 0, venues: 0, files: 0, envelopes: 0, vehicles: 0 };

/** The panels the portal page loads for itself, handed back here to be filed
 *  in the right drawer.
 *
 *  They used to be printed under this component, which meant the order of the
 *  couple's screen was decided in two files: the suppliers were here and the
 *  supplier desk was there, with the contracts between them. One component
 *  owns the order now. Each one is null when its module is closed, and a
 *  drawer with nothing in it is not drawn. */
export type PortalSlots = {
  vendorhq?: React.ReactNode;
  contracts?: React.ReactNode;
  venues?: React.ReactNode;
  bar?: React.ReactNode;
  studio?: React.ReactNode;
  files?: React.ReactNode;
  lists?: React.ReactNode;
  prep?: React.ReactNode;
  envelopes?: React.ReactNode;
  transport?: React.ReactNode;
  thread?: React.ReactNode;
  calendar?: React.ReactNode;
};

/** One event, as the couple sees it.
 *
 *  This is the couple's screen and the producer's preview of it, the same
 *  component either way. A preview assembled from its own markup would drift
 *  from the real thing the first time one of them changed, and a preview that
 *  is only nearly right is worse than none: it invites decisions about what
 *  the couple can see, based on a screen they never saw. */
export function PortalWorkspace({
  workspace, data, viewerId, ui, currentEventId, extra = NO_EXTRA, slots = {},
}: {
  workspace: Workspace; data: PortalData; viewerId: string; ui: AppUi; currentEventId?: string;
  extra?: PortalExtra; slots?: PortalSlots;
}) {
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

  /* Which sections this couple sees: closed by the plan or by the producer,
     through one gate. Every section below, the strip and the pills all read
     the same answer. */
  const can = (key: string) => data.can(c.id, key as never);

  /* What to do next, worked out from the rows already on this screen. No
     second query: everything the rule reads is in memory for the panels
     below, and a dashboard that asks the database six more questions to tell
     somebody what to do is a slow answer to a simple one. */
  const openTasks: TaskFact[] = filteredTasks.map((t) => ({
    title: t.title, due_on: t.due_on, done: t.done, owner: t.owner,
  }));
  /* The one area past its plan, from the same arithmetic the tracker below
     draws — so the card and the table can never disagree about whether the
     flowers are over. */
  const overArea = data.can(c.id, 'budget' as never)
    ? track(budget, c.budget_plan as never).flagged[0]?.key ?? null
    : null;
  const action = nextAction({
    today: todayInZone(),
    daysLeft: left,
    tasks: openTasks,
    payments: payments.map((p) => ({
      title: p.title, amount: Number(p.amount) || 0, due_on: p.due_on, paid: p.paid,
    })),
    guestsInvited: guests.length,
    guestsAnswered: guests.filter((g) => g.status !== 'pending').length,
    budgetLines: budget.length,
    budgetTarget: c.budget_target === null || c.budget_target === undefined ? null : Number(c.budget_target),
    overArea: overArea ? ui.money.plan.categories[overArea as keyof typeof ui.money.plan.categories] ?? null : null,
    boardImages: data.boardFor(c.id).length,
    can,
  });
  /* The two after it, and never the one already at the top of the card. */
  const then = upcoming(openTasks, 3).filter((t) => t.title !== action.subject).slice(0, 2);

  /* The first picture off their own board, and the only source of colour on
     this screen that is not the accent. Read through the same gate the board
     itself is behind, so a producer who has not opened that section to this
     couple has not accidentally published one of its images at the top of
     their screen. */
  const cover = can('moodboard') ? data.boardFor(c.id)[0]?.url : undefined;

  const rows = summaryRows({
    budget: agreed > 0 ? agreed : null,
    owed,
    openTasks: filteredTasks.filter((t) => !t.done).length,
    attending,
    invited: guests.length,
    tables: data.tablesFor(c.id).length,
    saved: data.boardFor(c.id).length,
    vendors: data.vendorsFor(c.id).length,
    meetings: data.meetingsFor(c.id).length,
    ...extra,
    can,
    c: ui.portal,
  });

  return (
    <div>
      {/* The way around used to be here, as a strip of seventeen chips stuck
          under the header. It is in the dock at the bottom of the screen now.
          A strip at the top is only at the top: it scrolls away with
          everything else, and a couple halfway down their own wedding was
          scrolling back up to navigate — which is the motion this was
          supposed to save. The dock travels with them, says which section
          they are in, and is in the corner a thumb is already resting in. */}

      {/* Their picture, their name, the count, in that order.
          The countdown used to be the largest thing here, at 104px, on the
          argument that it is the one number they open the app to see. That
          argument was about which figure matters and it is still true; what
          it got wrong is that a number is not a greeting. A screen that opens
          on four digits the height of a hand reads as a timer, and the
          instruction now is that opening this should feel like arriving
          somewhere calm.

          So the name is the largest thing and the count is one line under it,
          the way a screen names the place before it reports on it. The count
          did not become small: at 40 it is still the second largest thing on
          the screen and the only tabular figure above the fold.

          The picture is the first image from their own board, and it is where
          every colour on this screen that is not the accent comes from. That
          is the whole of the direction: the chrome stays quiet, the content
          carries the life. A couple who has not saved a picture yet gets no
          band and a screen that starts at their name, which is a first
          screen rather than a gap where something failed.

          The gold rule that closed this block is gone. The group below brings
          its own edge, and a hairline whose job is to separate two things
          that are already apart is one more object on a screen being counted
          down to four. */}
      <header className="mt-8">
        {cover && (
          /* Decoration, so it is hidden from a screen reader rather than
             described: the caption that belongs to it lives on the board
             itself, where somebody chose it. */
          <img
            src={cover} alt="" aria-hidden
            className="mb-6 aspect-[16/9] w-full rounded-card object-cover"
          />
        )}

        <h2 className="font-display text-display font-semibold leading-[1.12] tracking-[-.02em] text-ink">
          {c.display_name}
        </h2>

        <p className="mt-1.5 text-[14px] text-ink-mute">
          {formatDate(dateFmt, c.event_date, ui.portal.dateTbd)}
          {c.venue ? ` · ${c.venue}` : ''}
        </p>

        {left !== null && left >= 0 && (
          <p className="mt-6 flex items-baseline gap-2.5">
            <span className="font-display text-[40px] font-bold leading-none tracking-[-.03em] tabular-nums text-ink sm:text-[48px]">
              <Ltr>{left.toLocaleString('en-US')}</Ltr>
            </span>
            <span className="text-[15px] text-ink-mute">{ui.portal.daysLeft}</span>
          </p>
        )}
      </header>

      {/* The five questions, above everything, and only while any of them is
          still blank. They are what every panel below is waiting for: a hall
          cannot be compared without a guest count, a budget cannot be split
          without a total. It disappears the moment there is nothing left to
          ask rather than congratulating anybody for finishing it. */}
      <BeginFlow
        clientId={c.id}
        basics={{
          eventDate: c.event_date,
          guestEstimate: c.guest_estimate === null || c.guest_estimate === undefined ? null : Number(c.guest_estimate),
          region: c.region ?? '',
          budgetTarget: c.budget_target === null || c.budget_target === undefined ? null : Number(c.budget_target),
          hasPlan: c.budget_plan !== null,
        }}
      />

      {/* Before the figures, because the figures are the answer to a question
          nobody asked. What to do is the question they arrived with. */}
      <NextAction action={action} then={then} ui={ui} moneyOn={can('budget')} />

      <PortalSummary rows={rows} label={ui.portal.summary} />

      {/* The drawers. Tighter between them than inside them: closed, they
          should read as one short list rather than as six more sections. A
          drawer whose modules are all closed to this couple is not drawn at
          all — the same rule every panel here already followed, one level up.

          Nothing above this line is a list. The countdown, the five opening
          questions, the one thing to do next and four figures: that is the
          whole of what a couple is shown at rest, and all of it fits on a
          phone without scrolling past their own names. The lists — theirs,
          the money's, the guests' — are behind rows they can read.

          Their own tasks are the first drawer and not an exception to it. The
          card above already names the next one, with its date and the two
          after it; the panel underneath is where that gets done, and a list
          of sixteen open tasks is the single heaviest thing on this screen to
          arrive to. */}
      <div className="mt-10 space-y-3">
        {can('tasks') && (
          <Fold id="fold-mine" title={ui.portal.jumpMine} sub={ui.portal.foldMineSub}>
            <div id="tasks" data-jump={ui.portal.rowTasks} data-jump-group="me" className="scroll-mt-28"><TaskList clientId={c.id} tasks={filteredTasks} viewer="client" viewerId={viewerId} /></div>
          </Fold>
        )}

        {/* The same rows in a square, behind their own row. Under the tasks
            rather than over them because it is the lighter of the two and the
            list is where the work is done; and behind a fold of its own rather
            than inside the list's, because a game stacked on top of a
            checklist is a checklist that got longer. */}
        {can('bingo') && (
          <Fold id="fold-bingo" title={ui.portal.rowBingo} sub={ui.portal.bingo.sub}>
            <div id="bingo" data-jump={ui.portal.rowBingo} data-jump-group="me" className="scroll-mt-28">
              <WeddingBingo clientId={c.id} tasks={filteredTasks} />
            </div>
          </Fold>
        )}

        {/* Gated modules. A closed one is absent rather than greyed out: a
            locked panel advertising something the couple was not sold is a
            sales screen wearing the clothes of a tool. Money is one door for
            both the payments and the budget. */}
        {can('budget') && (
          <Fold id="fold-money" title={ui.portal.jumpMoney} sub={ui.portal.foldMoneySub}>
            {/* The working shown before the lists, and only once there is a
                budget to show: without lines the five figures are five
                zeros. */}
            {budget.length > 0 && (
              <FinanceSummary
                clientId={c.id} viewer="client"
                target={c.budget_target === null || c.budget_target === undefined ? null : Number(c.budget_target)}
                items={budget} payments={data.paymentsFor(c.id)}
              />
            )}
            <div id="payments" data-jump={ui.portal.rowPayments} data-jump-group="money" className="scroll-mt-28"><PaymentsPanel clientId={c.id} payments={payments} viewer="client" /></div>
            <div id="budget" data-jump={ui.portal.rowBudget} data-jump-group="money" className="scroll-mt-28 space-y-10">
              <BudgetTracker
                items={budget}
                payments={payments}
                plan={c.budget_plan}
                target={c.budget_target === null || c.budget_target === undefined ? null : Number(c.budget_target)}
              />
              <BudgetPanel clientId={c.id} items={budget} viewer="client" visible />
            </div>
          </Fold>
        )}

        {(can('guests') || can('seating') || (c.guest_site_on && c.guest_token)) && (
          <Fold id="fold-guests" title={ui.portal.jumpGuests} sub={ui.portal.foldGuestsSub}>
            {/* The link they paste into the family group, once the producer
                has switched the page on. First in this drawer because
                sending it is what a couple comes here to do before anybody
                has replied to anything. */}
            {c.guest_site_on && c.guest_token && <GuestSiteLink token={c.guest_token} />}
            {can('guests') && (
              <div id="guests" data-jump={ui.portal.rowRsvp} data-jump-group="guests" className="scroll-mt-28"><GuestList clientId={c.id} guests={guests} /></div>
            )}
            {can('seating') && (
              <div id="seating" data-jump={ui.portal.rowSeating} data-jump-group="guests" className="scroll-mt-28"><SeatingPlan clientId={c.id} tables={data.tablesFor(c.id)} guests={data.guestsFor(c.id) as never} /></div>
            )}
          </Fold>
        )}

        {/* Everything about who is hired: the suppliers, the desk the
            producer works them from, what was signed, the halls still being
            compared and what was agreed in a meeting. They were spread over
            two files and five places on the screen; a couple looking for
            "the photographer" was never going to guess which. */}
        {(can('vendors') || can('meetings') || slots.vendorhq || slots.contracts || slots.venues) && (
          <Fold id="fold-vendors" title={ui.portal.jumpVendors} sub={ui.portal.foldVendorsSub}>
            {can('vendors') && (
              <div id="vendors" data-jump={ui.portal.rowVendors} data-jump-group="vendors" className="scroll-mt-28 space-y-10">
                <PortalVendors vendors={data.vendorsFor(c.id)} c={ui.portal} locale={ui.locale} />
                {/* The quotes, the same table the producer reads, because there
                    is nothing to negotiate between them about what was quoted. */}
                <QuoteCompare
                  clientId={c.id} viewer="client"
                  vendors={data.vendorsFor(c.id)}
                  lines={budget.map((b) => ({ event_vendor_id: b.event_vendor_id ?? null, estimate: b.estimate, agreed: b.agreed }))}
                />
              </div>
            )}
            {slots.vendorhq}
            {slots.contracts}
            {slots.venues}
            {/* What was agreed, as the producer chose to share it. After the
                suppliers because a meeting is usually about one of them. */}
            {/* Only once there is a summary to read. This is the opposite call
                to the hall comparison and the supplier desk, and the line
                between them is whether the couple can do anything in the
                panel: those two are screens they act in, so an empty one is
                an invitation and worth a press. A meeting summary is written
                by the producer and only read here — an empty one announces
                that nothing has happened yet, which is a sentence, not a
                feature. */}
            {can('meetings') && data.meetingsFor(c.id).length > 0 && (
              <div id="meetings" data-jump={ui.portal.rowMeetings} data-jump-group="vendors" className="scroll-mt-28"><PortalMeetings meetings={data.meetingsFor(c.id)} ui={ui} /></div>
            )}
          </Fold>
        )}

        {/* The day itself and everything that dresses it: the hour-by-hour,
            the look, the songs, the faces, the cars, the envelopes — and the
            calendar that carries the dates onto their phones. */}
        {(can('runsheet') || can('moodboard') || slots.studio || slots.files || slots.lists
          || slots.prep || slots.envelopes || slots.transport || slots.calendar || slots.bar) && (
          <Fold id="fold-day" title={ui.portal.jumpDay} sub={ui.portal.foldDaySub}>
            {can('runsheet') && (
              <div id="runsheet" data-jump={ui.portal.rowRunsheet} data-jump-group="day" className="scroll-mt-28"><DaySchedule
                clientId={c.id}
                items={data.dayFor(c.id)}
                labelA={c.track_a_label}
                labelB={c.track_b_label}
                viewer="client"
              /></div>
            )}
            {can('moodboard') && (
              <div id="board" data-jump={ui.portal.rowBoard} data-jump-group="day" className="scroll-mt-28"><WinningBoard clientId={c.id} images={data.boardFor(c.id)} viewer="client" /></div>
            )}
            {slots.studio}
            {slots.lists}
            {/* Beside the songs and the kit rather than near the money: for a
                couple this is a shopping list, not a budget line. */}
            {slots.bar}
            {slots.prep}
            {slots.envelopes}
            {slots.transport}
            {slots.files}
            {slots.calendar}
          </Fold>
        )}

        {slots.thread && (
          <Fold id="fold-talk" title={ui.portal.jumpTalk} sub={ui.portal.foldTalkSub}>
            {slots.thread}
          </Fold>
        )}

        {/* Before I Do, after the drawers and outside all of them.
            Outside on purpose: every drawer on this screen is closed at rest,
            and a game nobody can see is a game nobody plays. It is one card,
            it is the last thing on the screen, and it is the only thing here
            that leaves the platform - so it opens in a tab of its own rather
            than swapping the screen out from under somebody mid-plan.
            Drawn only when he has opened it for this couple; the switch is
            his alone and lives on their file. */}
        {c.game_on && c.game_token && (
          <a
            href={`/play/${c.game_token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 block rounded-xl2 bg-dark px-6 py-7 text-surface transition hover:bg-dark/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden className="text-2xl text-coral">&#9829;</span>
            <span className="mt-2 block font-display text-[22px] font-medium">{ui.portal.gameCta}</span>
            <span className="mt-1.5 block max-w-md text-[14.5px] leading-relaxed text-surface/70">
              {ui.portal.gameSub}
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
