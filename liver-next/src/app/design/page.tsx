import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { appUiFor, prepFor, envelopesFor, vehiclesFor, meetingTemplatesFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { currentLocale } from '@/lib/serverLocale';
import { TaskList } from '@/components/app/TaskList';
import { PaymentsPanel } from '@/components/app/PaymentsPanel';
import { BudgetPanel } from '@/components/app/BudgetPanel';
import { BudgetPlanner } from '@/components/app/BudgetPlanner';
import { BudgetTracker } from '@/components/app/BudgetTracker';
import { GuestList } from '@/components/app/GuestList';
import { SeatingPlan } from '@/components/app/SeatingPlan';
import { DaySchedule } from '@/components/app/DaySchedule';
import { RunSheet } from '@/components/app/RunSheet';
import { PortalWorkspace } from '@/components/app/PortalWorkspace';
import { NextAction } from '@/components/app/NextAction';
import { BeginFlow } from '@/components/app/BeginFlow';
import { PortalVendors } from '@/components/app/PortalVendors';
import { PortalMeetings } from '@/components/app/PortalMeetings';
import { PortalNav } from '@/components/app/PortalNav';
import { ShareSwitches, TabShare } from '@/components/app/ShareSwitch';
import { TimelineDemo } from './TimelineDemo';
import { BudgetPlannerDemo } from './BudgetPlannerDemo';
import { VendorScoutDemo } from './VendorScoutDemo';
import { BrandStudioDemo } from './BrandStudioDemo';
import { DayDrawer } from '@/components/app/DayDrawer';
import { JournalBook } from '@/components/app/JournalBook';
import { CircleThread } from '@/components/app/CircleThread';
import { CircleFeed } from '@/components/app/CircleFeed';
import { GoogleSyncCard } from '@/components/app/GoogleSyncCard';
import { QuickLedger } from '@/components/app/QuickLedger';
import { LedgerEntries } from '@/components/app/LedgerEntries';
import { MonthGrid } from '@/components/app/MonthGrid';
import { VendorHq } from '@/components/app/VendorHq';
import { PlanOffer } from '@/components/app/PlanOffer';
import { ProductionBook } from '@/components/app/ProductionBook';
import { Thread } from '@/components/app/Thread';
import { Contracts } from '@/components/app/Contracts';
import { EventFiles } from '@/components/app/EventFiles';
import { EventFileLists } from '@/components/app/EventFileLists';
import { WinningBoard } from '@/components/app/WinningBoard';
import { Shop } from '@/components/marketing/Shop';
import { storeFor } from '@/content/ui';
import { StatusBoard } from '@/components/app/StatusBoard';
import { AttentionList } from '@/components/app/Attention';
import { OrdersBoard } from '@/components/app/OrdersBoard';
import { ArchiveShelf } from '@/components/app/ArchiveShelf';
import { CrewPanel } from '@/components/app/CrewPanel';
import { LeadRow } from '@/components/app/LeadRow';
import { VendorDirectory } from '@/components/app/VendorDirectory';
import { GuideBookView } from '@/components/app/GuideBook';
import { BeginHere } from '@/components/app/BeginHere';
import { producerGuide, clientGuideFor, guideUiFor } from '@/content/guide';
import { Anniversaries } from '@/components/app/Anniversaries';
import { BarCalculator } from '@/components/app/BarCalculator';
import { EventSummary } from '@/components/app/EventSummary';
import { FunnelChart, Sources, CashPanel, ResponsePanel } from '@/components/app/Insights';
import { Referrals } from '@/components/app/Referrals';
import { WorkflowTemplates } from '@/components/app/WorkflowTemplates';
import { MeetingDrawer } from '@/components/app/MeetingDrawer';
import { NotePad } from '@/components/app/NotePad';
import { MeetingTemplates } from '@/components/app/MeetingTemplates';
import { DayOfCockpit } from '@/components/app/DayOfCockpit';
import { CallsPanel } from '@/components/app/CallsPanel';
import { InviteBox } from '@/components/app/InviteBox';
import { NewClientForm } from '@/components/app/NewClientForm';
import { NewLeadForm } from '@/components/app/NewLeadForm';
import { CalendarFeed } from '@/components/app/CalendarFeed';
import {
  FIXTURE_CLIENT, FIXTURE_VIEWER,
  fixtureTasks, fixturePayments, fixtureBudget, fixtureGuests, fixtureTables,
  fixtureSeatGuests, fixtureDay, fixtureMessages, fixtureContracts, fixtureFiles, fixtureMedia,
  fixtureSongs, fixtureKit, fixturePeople, fixtureBoard, fixtureShopItems,
  fixtureStatus, fixtureAttention, fixtureOrders, fixtureShelf, fixtureCrew,
  fixtureLeads, fixtureCalls, fixtureVendors,
  fixtureAnniversaries, fixtureEventSummary, fixtureFunnel, fixtureSources,
  fixtureResponse, fixtureCash, fixtureReferrals, fixtureTemplates,
  fixtureMeetings, fixtureMeetingTemplates, fixtureDayLines, fixtureDayCrew, fixtureDayVendors,
  fixturePortalVendors,
  fixtureSheetGuests, fixtureSheetTables, fixtureSheetMoments, fixtureSheetArrivals,
  fixtureVips, fixtureLooks, fixtureShares,
} from '@/content/fixtures';
import { NumbersSheet } from '@/components/app/NumbersSheet';
import { GuestSiteView } from '@/components/guest/GuestSiteView';
import { RsvpForm } from '@/app/rsvp/[token]/RsvpForm';
import { rsvpFor } from '@/content/ui';
import { GuestSiteLink } from '@/components/app/GuestSiteLink';
import { GuestSiteCard } from '@/components/app/GuestSiteCard';
import { guestSiteFor } from '@/content/ui';
import { AppShell } from '@/components/app/AppShell';
import { ProducerLinkCard } from '@/components/app/ProducerLinkCard';
import { BrandEditor } from '@/components/app/BrandEditor';
import { BrandAssets } from '@/components/app/BrandAssets';
import { PrepSheet } from '@/components/app/PrepSheet';
import { VenueCompare } from '@/components/app/VenueCompare';
import { venuesFor } from '@/content/appUi';
import { fixtureVenues } from '@/content/fixtures';
import { PrepView } from '@/components/PrepView';
import { prepViewFor } from '@/content/prepView';
import { AdminRow } from '@/components/app/AdminRow';
import { NoticeBell } from '@/components/app/NoticeBell';
import { IssueReporter } from '@/components/app/IssueReporter';
import { VendorImport } from '@/components/app/VendorImport';
import { ProducerCopilot } from '@/components/app/ProducerCopilot';
import { QuickJump } from '@/components/app/QuickJump';
import { FinanceSummary } from '@/components/app/FinanceSummary';
import { ProducerLedger } from '@/components/app/ProducerLedger';
import { prepCopy } from '@/content/site';
import { HebrewCalendar } from '@/components/app/HebrewCalendar';
import { LabelToolbar } from '@/components/app/LabelToolbar';
import { EventTagPicker } from '@/components/app/EventTagPicker';
import { accentByKey } from '@/content/brand';
import type { Account } from '@/lib/auth';
import { PortalSummary, summaryRows } from '@/components/app/PortalSummary';
import { Metric, MetricRows, MetricBlock } from '@/components/app/Metric';
import { PageHead, Empty } from '@/components/app/PageHead';
import { TroubleLine } from '@/components/app/LoadTrouble';
import { FlashLine } from '@/components/app/Flash';
import { Avatar } from '@/components/app/Avatar';
import { ArchiveButton } from '@/components/app/ArchiveButton';
import { PrintButton } from '@/components/app/PrintButton';
import { RegionPicker } from '@/components/RegionPicker';
import { PromiseLine } from '@/components/Promise';
import { Ltr, Money, Ratio } from '@/components/Ltr';
import { REGIONS } from '@/content/site';
import { PortalActions } from '@/components/app/PortalActions';
import { EventTabs } from '@/components/app/EventTabs';
import { EventDetails } from '@/components/app/EventDetails';
import { EventVendors } from '@/components/app/EventVendors';
import { FeatureFlags } from '@/components/app/FeatureFlags';
import { SiteEditor } from '@/components/app/SiteEditor';
import { SopBook } from '@/components/app/SopBook';
import { MediaVault } from '@/components/app/MediaVault';
import { StoreProducts } from '@/components/app/StoreProducts';
import { GuestImport } from '@/components/app/GuestImport';
import { ReceiptScan } from '@/components/app/ReceiptScan';
import { CodeInput } from '@/components/app/CodeInput';
import { SignLink } from '@/components/app/SignLink';
import { ApplyTemplate } from '@/components/app/ApplyTemplate';
import { EventTemplate } from '@/components/app/EventTemplate';
import { CoupleCompanion } from '@/components/app/CoupleCompanion';
import { companionFor } from '@/content/appUi';
import ConsoleLoading from '@/app/app/loading';
import EventLoading from '@/app/app/clients/[id]/loading';
import PortalLoading from '@/app/app/portal/loading';
import { EventSelector } from '@/components/portal/EventSelector';
import { VendorCaptureDemo } from './VendorCaptureDemo';
import { EnvelopesPanel } from '@/components/app/EnvelopesPanel';
import { VehiclesPanel } from '@/components/app/VehiclesPanel';

/**
 * Every panel in the product, on one page, with no database behind it.
 *
 * Why it exists: everything inside `/app` is behind sign in and reads from
 * Supabase, so looking at a screen required an account, a network and real
 * data belonging to a real couple. That is workable for testing and useless
 * for design, which is the act of looking at a screen and deciding whether it
 * holds together. Half of this product could not be looked at at all, and
 * three design bugs on the marketing site were found by looking rather than by
 * reading, so the half nobody could see is the half worth worrying about.
 *
 * It renders the real components with invented data, in both viewer roles, so
 * the difference between what a producer sees and what a couple sees is a
 * thing you can look at side by side rather than reason about.
 *
 * Development only, and not by convention: `notFound()` on a production build
 * means the route does not exist on the server, so no amount of guessing the
 * URL reaches it. It is also absent from the sitemap and disallowed in
 * robots.txt, which are belt to that pair of braces rather than the lock.
 *
 * Nothing here writes. The forms post to the same server actions the real
 * screens use, and those check a session first, so a submitted form fails
 * cleanly rather than touching anybody's event.
 *
 * Open it at http://localhost:<port>, not 127.0.0.1. The dev server treats
 * an unlisted origin as cross-origin and answers its CORS-mode chunk requests
 * with an empty 403, so the page renders from the server and never hydrates:
 * every client component looks fine and does nothing. That is what a
 * screenshot cannot tell you, and it cost an afternoon of "the link field is
 * empty" before the probe found two 403s. `allowedDevOrigins` in next.config
 * now lists 127.0.0.1 as a belt to this pair of braces.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Design harness',
  robots: { index: false, follow: false, nocache: true },
};

function Panel({ name, note, children }: { name: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
        <h2 className="font-display text-[17px] font-semibold text-ink">{name}</h2>
        {note && <p className="text-[12.5px] text-ink-mute">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function DesignPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const locale = await currentLocale();
  const ui = appUiFor(locale);
  const client = FIXTURE_CLIENT;

  return (
    <CopyProvider value={ui}>
      <main id="main" className="shell py-10">
        <p className="eyebrow">design harness</p>
        <h1 className="mt-3 font-display text-display font-semibold text-ink">
          {locale === 'en' ? 'Every panel, no database' : 'כל הפאנלים, בלי מסד נתונים'}
        </h1>
        <p className="measure mt-3 text-[14.5px] text-ink-soft">
          {locale === 'en'
            ? 'Invented data, the real components. Development only.'
            : 'נתונים מומצאים, הרכיבים האמיתיים. סביבת פיתוח בלבד.'}
        </p>

        <Panel name="TaskList · producer" note="owner column, private rows, template button">
          <TaskList clientId={client} tasks={fixtureTasks} viewer="producer" viewerId={FIXTURE_VIEWER} />
        </Panel>

        <Panel name="TaskList · client" note="the same list, the couple's wording">
          <TaskList clientId={client} tasks={fixtureTasks} viewer="client" viewerId={FIXTURE_VIEWER} />
        </Panel>

        <Panel name="PaymentsPanel · client" note="one paid, one overdue, one ahead">
          <PaymentsPanel clientId={client} payments={fixturePayments} viewer="client" />
        </Panel>

        <Panel name="FinanceSummary · producer" note="the five figures and the working; a target is set and the event is inside it">
          <FinanceSummary clientId={client} viewer="producer" target={260000} items={fixtureBudget} payments={fixturePayments} />
        </Panel>

        <Panel name="FinanceSummary · client, over budget" note="the same figures seen by the couple, with the overrun badge">
          <FinanceSummary clientId={client} viewer="client" target={60000} items={fixtureBudget} payments={fixturePayments} />
        </Panel>

        {/* The producer's bottom line, in the three states worth looking at:
            healthy, a loss, and the ordinary month-three shape where costs
            exist and nothing has been billed. */}
        <Panel name="ProducerLedger · healthy" note="billed, received, costs and what is left">
          <ProducerLedger
            c={ui.money.ledger}
            /* Billed above the costs, which is what a healthy event looks
               like. The first version of this panel reused fixturePayments,
               whose total is a fraction of the budget fixture, so the panel
               labelled "healthy" rendered a hundred-and-fourteen per cent
               loss — a harness that lies about which state it is showing is
               worse than no harness. */
            payments={[
              { amount: 190000, paid: true },
              { amount: 110000, paid: false },
            ]}
            items={fixtureBudget}
            crew={[{ fee: 5000 }, { fee: 3200 }, { fee: null }]}
          />
        </Panel>

        <Panel name="ProducerLedger · at a loss" note="the figure worth having on exactly the events where it is unwelcome">
          <ProducerLedger
            c={ui.money.ledger}
            payments={[{ amount: 42000, paid: true }]}
            items={fixtureBudget}
            crew={[{ fee: 5000 }]}
          />
        </Panel>

        <Panel name="ProducerLedger · costs before billing" note="the normal shape three months out, which must not read as a loss">
          <ProducerLedger
            c={ui.money.ledger}
            payments={[]}
            items={fixtureBudget}
            crew={[{ fee: 5000 }]}
          />
        </Panel>

        <Panel name="ProducerLedger · nothing yet" note="a brand new event">
          <ProducerLedger c={ui.money.ledger} payments={[]} items={[]} crew={[]} />
        </Panel>

        <Panel name="BudgetPanel · producer" note="an agreed figure, two still open">
          <BudgetPanel clientId={client} items={fixtureBudget} viewer="producer" visible />
        </Panel>

        <Panel name="GuestList" note="attending, declined, no answer, a six person party">
          <GuestList clientId={client} guests={fixtureGuests} />
        </Panel>

        <Panel name="SeatingPlan" note="two tables filled, one guest unseated">
          <SeatingPlan clientId={client} tables={fixtureTables} guests={fixtureSeatGuests} />
        </Panel>

        {/* The document that gets carried, printed. Reachable here at all
            because it is a component now: it used to be markup inside a page
            that needed an account and a database, which is why nobody had
            ever looked at it. */}
        {/* The offer that replaces "no tasks yet" on a producer's first
            event. Written, shipped, and until now never looked at. */}
        <Panel name="PlanOffer" note="what an empty task list says to somebody who has never used this">
          <PlanOffer clientId={client} />
        </Panel>

        {/* The whole event on one document, printed. The other two print
            documents are here; this one was not, which is why nobody had seen
            it come out of a printer either. */}
        <Panel name="ProductionBook · printed" note="the folder copy: cover, arrivals, running order, suppliers, guests, money">
          <ProductionBook
            c={appUiFor('he').book}
            locale="he"
            client={{
              display_name: 'נועה ואיתי', event_date: '2026-09-04', venue: 'אחוזת הכפר',
              contact_phone: '052-555-0100', contact_email: 'noa@example.com',
            }}
            brand={{ name: 'ברק ליור', tagline: 'הפקת אירועים' }}
            standing={{ phase: 'guests', expected: 'final', behind: 1, ahead: 0 }}
            daysToEvent={12}
            guests={{
              invited: 180, coming: 142, declined: 21, pending: 17, heads: 168,
              diets: [{ label: 'צמחוני', count: 14 }, { label: 'ללא גלוטן', count: 3 }],
            }}
            vendors={[
              { id: 'v1', name: 'קייטרינג הגן', category: 'קייטרינג', phone: '052-555-1234', status: 'booked', call_time: '15:00' },
              { id: 'v2', name: 'אבי כהן', category: 'צילום', phone: '054-555-8877', status: 'booked', call_time: '17:30' },
              { id: 'v3', name: 'אור ותאורה', category: 'תאורה', phone: '050-555-4412', status: 'shortlist', call_time: null },
            ]}
            crew={[{ id: 'k1', name: 'רותי', role: 'מפיקה בשטח', phone: '053-555-2020', call_time: '14:00' }]}
            moments={fixtureDay.map((d) => ({
              id: d.id, at_time: d.at_time, title: d.title, note: d.note ?? '', owner: d.owner ?? '',
            }))}
            tasks={fixtureTasks.map((t) => ({ id: t.id, title: t.title, due_on: t.due_on, done: t.done }))}
            payments={fixturePayments.map((p, i) => ({
              id: String(i), title: p.title, amount: Number(p.amount), due_on: p.due_on, paid: p.paid,
            }))}
          />
        </Panel>

        {/* The screen a producer's clients actually see, and the last one
            in this product nobody had ever rendered. Assembled from the same
            fixtures the panels below use, so what appears here is what the
            couple gets. */}
        {/* The card the whole dashboard now opens with, in the four states
            worth looking at: money already late, a task this week, an event
            with nothing on it, and a week where everything is handled. The
            fourth is the one a screen usually gets wrong by inventing
            something to nag about. */}
        {/* The five questions, in the two states that matter: an event nobody
            has filled in, and one where the producer already agreed a date
            and a guest count, so only three questions are left. */}
        <Panel name="BeginFlow" note="five short questions, asked once, built from what the event is still missing">
          <div className="max-w-3xl space-y-5">
            <BeginFlow
              clientId={client}
              defaultOpen
              basics={{ eventDate: null, guestEstimate: null, region: '', budgetTarget: null, hasPlan: false }}
            />
            <BeginFlow
              clientId={client}
              basics={{ eventDate: '2026-12-05', guestEstimate: 180, region: '', budgetTarget: null, hasPlan: false }}
            />
          </div>
        </Panel>

        <Panel name="NextAction" note="one thing to do, why it is that one, and the button that does it">
          <div className="space-y-5">
            <NextAction
              ui={appUiFor('he')} moneyOn
              action={{ code: 'payLate', subject: 'מקדמה לאולם', n: 37000, due: '2026-08-20', late: true, section: 'payments' }}
              then={[
                { title: 'לבחור שיר לכניסה לחופה', due_on: null, done: false, owner: 'client' },
                { title: 'תיאום סופי עם הצלם', due_on: '2026-09-22', done: false, owner: 'producer' },
              ]}
            />
            <NextAction
              ui={appUiFor('he')} moneyOn
              action={{ code: 'guestsChase', subject: '', n: 30, due: null, late: false, section: 'guests' }}
              then={[{ title: 'לסגור טעימות עם הקייטרינג', due_on: '2026-09-15', done: false, owner: 'client' }]}
            />
            <NextAction
              ui={appUiFor('he')} moneyOn={false}
              action={{ code: 'start', subject: '', n: 0, due: null, late: false, section: 'tasks' }}
              then={[]}
            />
            <NextAction
              ui={appUiFor('he')} moneyOn
              action={{ code: 'clear', subject: '', n: 0, due: null, late: false, section: 'tasks' }}
              then={[]}
            />
          </div>
        </Panel>

        <Panel name="PortalWorkspace · the couple" note="what a couple opens: the countdown, the four numbers, then the panels">
          <PortalWorkspace
            ui={appUiFor('he')}
            viewerId="fixture-viewer"
            workspace={{
              id: client, display_name: 'נועה ואיתי',
              /* Deliberately in the future. The first version of this fixture
                 dated the wedding two days in the past, which hid the
                 countdown — the one thing the component's own comment calls
                 the largest thing on the couple's screen — and made a working
                 feature look missing. */
              event_date: '2026-12-05',
              venue: 'אחוזת הכפר', guest_estimate: 180, region: 'השרון', budget_visible: true, shared_sections: {}, budget_plan: null,
              budget_target: 260000, track_a_label: 'נועה', track_b_label: 'איתי',
              guest_token: 'demo-token', guest_site_on: true, brand: null,
            }}
            data={{
              workspaces: [],
              can: () => true,
              tasksFor: () => fixtureTasks,
              paymentsFor: () => fixturePayments,
              budgetFor: () => fixtureBudget,
              guestsFor: () => fixtureGuests,
              tablesFor: () => fixtureTables,
              dayFor: () => fixtureDay,
              boardFor: () => [],
              vendorsFor: () => fixturePortalVendors,
              meetingsFor: () => fixtureMeetings.filter((m) => m.visible_to_client).map((m) => ({ id: m.id, client_id: client, kind: m.kind, title: m.title, held_on: m.held_on, summary: m.summary })),
              eventsFor: () => [],
            }}
          />
        </Panel>

        {/* The other half of the switch on every meeting form. Shown with
            the one shared fixture and then with none, because the empty
            sentence is the one most couples read first. */}
        <Panel name="PortalMeetings" note="the meetings a producer shared, as the couple reads them: title, date, what was agreed; and the screen with none shared yet">
          <div className="space-y-5">
            <PortalMeetings ui={appUiFor('he')} meetings={fixtureMeetings.filter((m) => m.visible_to_client).map((m) => ({ id: m.id, client_id: client, kind: m.kind, title: m.title, held_on: m.held_on, summary: m.summary }))} />
            <PortalMeetings ui={appUiFor('he')} meetings={[]} />
          </div>
        </Panel>

        <Panel name="PortalVendors" note="the couple's suppliers: two booked, one still open, grouped the producer's way">
          <PortalVendors vendors={fixturePortalVendors} c={ui.portal} locale={locale} />
        </Panel>

        <Panel name="ShareSwitch" note="the page of switches on the preview, and the one row a producer's tab carries; envelopes closed, money open">
          <div className="max-w-2xl space-y-6">
            <ShareSwitches clientId="00000000-0000-4000-8000-000000000003" shares={{ envelopes: false }} moneyOn />
            <TabShare clientId="00000000-0000-4000-8000-000000000003" tab="prep" shares={{ envelopes: false }} moneyOn />
            <TabShare clientId="00000000-0000-4000-8000-000000000003" tab="money" shares={{}} moneyOn={false} />
          </div>
        </Panel>

        <Panel name="VendorHq" note="every supplier on one event with an honest status: one red, one amber, two green; the week's list and the three to watch">
          <div className="max-w-5xl">
            <VendorHq
              clientId="00000000-0000-4000-8000-000000000003" viewer="producer" couple="נועה ואיתי" date="2026-12-05" signAs="ברק"
              vendors={[
                { id: 'h1', name: 'גני ורדים', category: 'venue', phone: '0521111111', status: 'booked', notes: '', deposit: 30000, deposit_paid_on: '2026-03-01', balance_due_on: '2026-09-15', last_contact_on: '2026-09-02', waiting_on: null, next_action: '' },
                { id: 'h2', name: 'סטודיו לביא', category: 'photo', phone: '0522222222', status: 'booked', notes: '', deposit: 3000, deposit_paid_on: null, balance_due_on: null, last_contact_on: '2026-08-20', waiting_on: 'them', next_action: '' },
                { id: 'h3', name: 'להקת שדות', category: 'music', phone: '', status: 'booked', notes: '', deposit: null, deposit_paid_on: null, balance_due_on: null, last_contact_on: '2026-09-09', waiting_on: 'me', next_action: 'לשלוח את רשימת השירים' },
                { id: 'h4', name: 'פרח לבן', category: 'floral', phone: '0523333333', status: 'shortlist', notes: '', deposit: null, deposit_paid_on: null, balance_due_on: null, last_contact_on: null, waiting_on: null, next_action: '' },
              ]}
              contracts={[
                { party_name: 'גני ורדים', status: 'signed', signed_at: '2026-03-01' },
                { party_name: 'סטודיו לביא', status: 'sent', signed_at: null },
              ]}
              lines={[
                { event_vendor_id: 'h1', estimate: 150000, agreed: 162000 },
                { event_vendor_id: 'h2', estimate: 14000, agreed: 13500 },
              ]}
            />
          </div>
        </Panel>

        <Panel name="JournalBook" note="the couple's notebook of other people's weddings: two logged, the summary they add up to, and the form">
          <div className="max-w-4xl">
            <JournalBook
              clientId="00000000-0000-4000-8000-000000000003" viewer="client"
              logs={[
                { id: 'j1', venue_name: 'אחוזת הכפר', event_date: '2026-06-12', style: 'garden',
                  pros: ['foodGood', 'ranOnTime'], cons: ['barQueue', 'musicTooLoud'],
                  pros_note: 'הקינוחים היו הדבר שכולם דיברו עליו', cons_note: 'רבע שעה לכוס יין',
                  takeaways: 'שני ברמנים, לא אחד\nלהוריד את המוזיקה בזמן האוכל', photos: [], photoUrls: [] },
                { id: 'j2', venue_name: 'גני ורדים', event_date: '2026-05-01', style: 'hall',
                  pros: ['barFast', 'seatingEnough'], cons: ['startedLate'],
                  pros_note: '', cons_note: 'החופה התחילה ארבעים דקות אחרי',
                  takeaways: 'לכתוב בהזמנה שעה שהיא באמת השעה', photos: [], photoUrls: [] },
              ]}
            />
          </div>
        </Panel>

        <Panel name="CircleFeed" note="the circle of one producer's couples: a named question, an anonymous one, and the producer's own, with votes">
          <div className="max-w-3xl">
            <CircleFeed
              producerId="00000000-0000-4000-8000-000000000009" clientId="00000000-0000-4000-8000-000000000003"
              category="" viewer="client"
              posts={[
                { id: 'p1', category: 'vendors', title: 'מישהו עבד עם צלם מהצפון שלא גובה נסיעות?', content: 'אנחנו מתחתנים בגליל והצעות המחיר שקיבלנו כולן עם תוספת נסיעה של אלף שקל.', upvotes: 4, created_at: '2026-09-01T10:00:00Z', is_anonymous: false, is_producer: false, author_name: 'נועה כהן', months_out: null, mine: false, voted: true, replies: 3 },
                { id: 'p2', category: 'food', title: 'כמה אלכוהול באמת צריך ל-180 איש?', content: 'האולם מציע חבילה, ומחוץ לאולם אמרו לנו שזה כפול ממה שצריך.', upvotes: 1, created_at: '2026-08-28T09:00:00Z', is_anonymous: true, is_producer: false, author_name: '', months_out: 4, mine: true, voted: false, replies: 0 },
                { id: 'p3', category: 'general', title: 'על השאלה של הבר: המספרים שאני עובד לפיהם', content: 'שלוש מנות לאורח בערב של חמש שעות, ורבע מזה ויסקי.', upvotes: 9, created_at: '2026-08-27T09:00:00Z', is_anonymous: false, is_producer: true, author_name: 'ברק', months_out: null, mine: false, voted: false, replies: 1 },
              ]}
            />
          </div>
        </Panel>

        <Panel name="CircleThread" note="one question with an answer from another couple and one from the producer, which carries the badge">
          <div className="max-w-3xl">
            <CircleThread
              clientId="00000000-0000-4000-8000-000000000003" viewer="client"
              post={{ id: 'p1', category: 'vendors', title: 'מישהו עבד עם צלם מהצפון שלא גובה נסיעות?', content: 'אנחנו מתחתנים בגליל והצעות המחיר שקיבלנו כולן עם תוספת נסיעה של אלף שקל.', upvotes: 4, created_at: '2026-09-01T10:00:00Z', is_anonymous: false, is_producer: false, author_name: 'נועה כהן', months_out: null, mine: false, voted: true, replies: 2 }}
              replies={[
                { id: 'r1', content: 'עבדנו עם סטודיו לביא, הם מהעמק ולא גבו נסיעות. שווה לבקש מהם את המחיר בלי אלבום.', created_at: '2026-09-01T12:00:00Z', is_anonymous: true, is_producer: false, author_name: '', months_out: 7, mine: false },
                { id: 'r2', content: 'שני צלמים שאני עובד איתם בצפון לא גובים נסיעה מעל שש שעות צילום. אשלח לכם את שניהם בהודעה.', created_at: '2026-09-01T13:30:00Z', is_anonymous: false, is_producer: true, author_name: 'ברק', months_out: null, mine: false },
              ]}
            />
          </div>
        </Panel>

        <Panel name="DayDrawer" note="one day opened from the grid: a wedding, a payment and an entry of the producer's own, with the form that adds another">
          <div className="max-w-3xl">
            <DayDrawer
              day="2026-10-02" dayText="יום שישי, 2 באוקטובר 2026"
              items={[
                { id: 'event-c1', kind: 'event', date: '2026-10-02', title: 'לי ורותם', detail: 'שדה חמד · 180 אורחים', href: '/app/clients/c1', clientId: 'c1', color: '#2F6F5E' },
                { id: 'pay-p1', kind: 'payment', date: '2026-10-02', title: 'יתרה לאולם', detail: 'לי ורותם', href: '/app/clients/c1?tab=money', clientId: 'c1', amount: 42000 },
                { id: 'entry-e1', rowId: 'e1', kind: 'entry', date: '2026-10-02', time: '10:00', title: '10:00 פגישה עם הפרחים', detail: 'לי ורותם · להביא דוגמאות', href: '/app/calendar?day=2026-10-02', clientId: 'c1' },
              ]}
              entries={[{ id: 'e1', client_id: 'c1', title: 'פגישה עם הפרחים', on_date: '2026-10-02', at_time: '10:00:00', duration_min: 90, note: 'להביא דוגמאות' }]}
              clients={[{ id: 'c1', name: 'לי ורותם' }, { id: 'c2', name: 'נועה ואיתי' }]}
            />
          </div>
        </Panel>

        <Panel name="GoogleSyncCard" note="the Google Calendar link: not configured, ready to connect, and connected with a last sync and one failure">
          <div className="max-w-3xl space-y-4">
            <GoogleSyncCard ui={ui} status={null} configured={false} notice="" />
            <GoogleSyncCard ui={ui} status={null} configured notice="denied" />
            <GoogleSyncCard ui={ui} status={{ email: 'barak@gmail.com', ready: true, connected_at: '2026-09-10T08:00:00Z', last_sync_at: '2026-09-10T09:15:00Z', last_error: '' }} configured notice="connected" />
            <GoogleSyncCard ui={ui} status={{ email: 'barak@gmail.com', ready: true, connected_at: '2026-09-10T08:00:00Z', last_sync_at: '2026-09-10T09:30:00Z', last_error: 'google 401: invalid_grant' }} configured notice="" />
          </div>
        </Panel>

        <Panel name="BrandStudio" note="the wedding's brand read off the board: the sheet, the seven pieces in two options, where to print; the producer's side, then the couple's">
          <div className="max-w-5xl space-y-10">
            <BrandStudioDemo viewer="producer" />
            <BrandStudioDemo viewer="client" />
          </div>
        </Panel>

        <Panel name="VendorScout" note="five from the producer's book for one couple: scores, flags, the message; opened and ranked">
          <div className="max-w-4xl"><VendorScoutDemo /></div>
        </Panel>

        <Panel name="QuickLedger" note="the plus in the header, and what it recorded on the event and across the business">
          <div className="max-w-3xl space-y-6">
            <QuickLedger events={[{ id: '00000000-0000-4000-8000-000000000003', name: 'נועה ואיתי', date: '2026-12-05' }]} />
            <LedgerEntries entries={[
              { id: 'l1', client_id: '00000000-0000-4000-8000-000000000003', kind: 'income', amount: 5000, label: 'מקדמה', party: '', note: '', on_date: '2026-09-08', event_name: 'נועה ואיתי' },
              { id: 'l2', client_id: null, kind: 'income', amount: 100, label: 'טיפ מהערב', party: 'משפחת לוי', note: '', on_date: '2026-09-06', event_name: null },
              { id: 'l3', client_id: null, kind: 'expense', amount: 60, label: 'חניה', party: '', note: 'אולם, סיור', on_date: '2026-09-05', event_name: null },
            ]} />
          </div>
        </Panel>

        <Panel name="MonthGrid" note="one month, any year, with the holidays named: every couple's deadline in its cell, the day tinted by the Hebrew calendar, today in a circle">
          <MonthGrid
            month="2026-09"
            today="2026-09-10"
            switches={{ jewish: true, christian: true }}
            locale={locale}
            ui={ui}
            items={[
              { id: 'e1', kind: 'event', date: '2026-10-15', title: 'מאיה ועידו', detail: 'גני הדר · 180 אורחים', href: '#', clientId: 'c1', color: '#7c5cff' },
              { id: 't1', kind: 'task', date: '2026-09-17', title: 'לשלוח הזמנות', detail: 'מאיה ועידו', href: '#', clientId: 'c1' },
              { id: 't2', kind: 'task', date: '2026-09-17', title: 'טעימות', detail: 'נועה ואיתי', href: '#', clientId: 'c2' },
              { id: 't3', kind: 'task', date: '2026-09-17', title: 'לסגור פרחים', detail: 'נועה ואיתי', href: '#', clientId: 'c2' },
              { id: 't4', kind: 'task', date: '2026-09-17', title: 'הזמנת טבעות', detail: 'דנה ויואב', href: '#', clientId: 'c3' },
              { id: 'p1', kind: 'payment', date: '2026-10-01', title: 'יתרה לאולם', detail: 'מאיה ועידו', href: '#', clientId: 'c1', amount: 50000 },
              { id: 't5', kind: 'task', date: '2026-09-14', title: 'מדידה שנייה', detail: 'מאיה ועידו', href: '#', clientId: 'c1', done: true },
            ]}
          />
        </Panel>

        <Panel name="BudgetPlanner" note="the split before the spending: photo non-negotiable, invitations and other to cut; opened">
          <div className="max-w-4xl"><BudgetPlannerDemo /></div>
        </Panel>

        <Panel name="BudgetTracker" note="planned against booked: design over by twelve percent, a trade-off offered, the three Sunday lines">
          <div className="max-w-4xl">
            <BudgetTracker
              items={fixtureBudget}
              payments={fixturePayments}
              target={260000}
              plan={{
                total: 260000, guests: 180, must: ['photo'], nice: ['invites', 'other'],
                splits: { venue: 52, bar: 7, photo: 6, music: 4, design: 8, look: 5, invites: 1, transport: 2, other: 9, contingency: 6 },
              }}
            />
          </div>
        </Panel>

        <Panel name="TimelineBuilder" note="the year's plan for a wedding next June, opened: inputs, the table, the tips">
          <div className="max-w-4xl">
            <TimelineDemo />
          </div>
        </Panel>

        <Panel name="PortalNav" note="the pills under the header on the couple's screen, one per open section">
          <div className="max-w-2xl">
            <PortalNav
              sticky={false}
              label={ui.portal.nav}
              rows={summaryRows({
                budget: 148000, owed: 32000, openTasks: 9,
                attending: 96, invited: 180, tables: 18,
                contracts: 2, venues: 3, files: 5, saved: 12, vendors: 7, meetings: 1,
                envelopes: 3, vehicles: 2,
                can: (key) => key !== 'seating',
                c: ui.portal,
              })}
            />
          </div>
        </Panel>

        <Panel name="RunSheet · printed" note="the page somebody holds at eleven at night: big clock, tick boxes, numbers">
          <RunSheet
            c={ui.runsheet}
            client={{ display_name: 'נועה ואיתי', venue: 'אחוזת הכפר' }}
            brand={{ name: 'ברק ליור', tagline: 'הפקת אירועים' }}
            lines={fixtureDay.map((d) => ({
              id: d.id, at_time: d.at_time, title: d.title,
              note: d.note ?? '', owner: d.owner ?? '', audience: d.audience ?? [],
            }))}
            contacts={[
              { id: 'c1', name: 'רונית לוי', role: 'קייטרינג', phone: '052-555-1234', at: '15:00' },
              { id: 'c2', name: 'אבי כהן', role: 'צילום', phone: '054-555-8877', at: '17:30' },
              { id: 'c3', name: 'דנה שגב', role: 'תאורה', phone: '050-555-4412', at: '23:30' },
              { id: 'c4', name: 'יוסי מור', role: 'הגברה', phone: '053-555-9090', at: null },
            ]}
            staffVisible
            dateLabel="שבת, 4 בספטמבר 2026"
            audienceLabel={(v) => v}
            printedLabel="4.9.2026"
          />
        </Panel>

        <Panel name="DaySchedule · producer" note="three tracks, key moments, past midnight">
          <DaySchedule clientId={client} items={fixtureDay} labelA="נועה" labelB="איתי" viewer="producer" />
        </Panel>

        <Panel name="Thread" note="both sides, one message minutes old">
          <Thread clientId={client} messages={fixtureMessages} viewerId={FIXTURE_VIEWER} />
        </Panel>

        <Panel name="Contracts · client" note="one signed, one waiting on a supplier">
          <Contracts clientId={client} contracts={fixtureContracts} viewer="client" />
        </Panel>

        <Panel name="EventFiles · client" note="a document and a spreadsheet, no photographs">
          <EventFiles clientId={client} files={fixtureFiles} viewer="client" />
        </Panel>

        <Panel name="EventFileLists · client" note="two songs of seven, equipment part sorted">
          <EventFileLists
            clientId={client} songs={fixtureSongs} kit={fixtureKit} people={fixturePeople} viewer="client"
          />
        </Panel>

        <Panel name="WinningBoard · client" note="empty, which is what a new event looks like">
          <WinningBoard clientId={client} images={fixtureBoard} viewer="client" />
        </Panel>

        <Panel name="Shop" note="the public shopfront, portfolio stills as product images">
          <Shop producerId="00000000-0000-4000-8000-00000000000f" items={fixtureShopItems} copy={storeFor(locale)} />
        </Panel>

        {/* ── The producer's own screens ─────────────────────────────── */}

        <Panel name="AttentionList" note="the overview's top: two now, two soon">
          <AttentionList items={fixtureAttention} />
        </Panel>

        <Panel name="StatusBoard" note="one event with gaps, one clean, one past its date">
          <StatusBoard items={fixtureStatus} />
        </Panel>

        <Panel name="LeadRow" note="a site lead with an open call, and a corporate one">
          <ul className="list-none space-y-3 p-0">
            {fixtureLeads.map((l) => (
              <LeadRow key={l.id} lead={l} calls={fixtureCalls.filter((x) => x.lead_id === l.id)} />
            ))}
          </ul>
        </Panel>

        <Panel name="VendorDirectory" note="two live suppliers and one archived">
          <VendorDirectory vendors={fixtureVendors} />
        </Panel>

        <Panel name="CrewPanel" note="producer only: fees are visible here and nowhere else">
          <CrewPanel clientId={client} crew={fixtureCrew} />
        </Panel>

        <Panel name="OrdersBoard" note="pending, paid and a draft">
          <OrdersBoard orders={fixtureOrders} />
        </Panel>

        <Panel name="ArchiveShelf" note="one year, two closed events">
          <ArchiveShelf shelf={fixtureShelf} />
        </Panel>

        <Panel name="EventSummary" note="the top of an event's file: tiles, then the nearest moves">
          <EventSummary clientId={client} summary={fixtureEventSummary} />
        </Panel>

        <Panel name="DayOfCockpit" note="the evening itself: one line done, a key moment ahead, past midnight">
          <DayOfCockpit
            clientId={client} eventDate={new Date().toISOString().slice(0, 10)}
            lines={fixtureDayLines} crew={fixtureDayCrew} vendors={fixtureDayVendors}
          />
        </Panel>

        <Panel name="BarCalculator" note="live arithmetic; nothing here saves">
          <BarCalculator guestEstimate={220} confirmedGuests={141} />
        </Panel>

        <Panel name="MeetingDrawer" note="one meeting written up, one not yet held, one from the producer's own template">
          <MeetingDrawer clientId={client} logs={fixtureMeetings} own={fixtureMeetingTemplates} />
        </Panel>

        {/* The screen with nothing else on it. Shown here written on rather
            than empty, because an empty one is a rectangle and tells nobody
            whether the type on it is readable across a table. */}
        <Panel name="NotePad" note="the blank page: a date, a title if you want one, and the rest of the screen">
          <NotePad
            clientId={client}
            eventName="נועה ואיתי"
            /* The real screen puts the cursor in the page the moment it
               opens. A gallery of ninety panels must not, or opening it
               scrolls to this one. */
            takeFocus={false}
            note={{
              id: '00000000-0000-4000-8000-0000000000b1',
              title: 'ישיבה עם ההורים על רשימת האורחים',
              held_on: '2026-09-08',
              body: 'אמא של נועה רוצה להוסיף שתי משפחות, בערך 14 איש. סיכמנו שנבדוק מול האולם אם אפשר להגיע ל-230 בלי לשנות את הסידור.\n\nאיתי מבקש שהמוזיקה בקבלת פנים תהיה שקטה יותר. לדבר עם הדי.ג׳יי.\n\nלבדוק הסעה מירושלים.',
              updated_at: null,
            }}
          />
        </Panel>

        <Panel name="WorkflowTemplates" note="two templates, steps counted back from the day">
          <WorkflowTemplates templates={fixtureTemplates} />
        </Panel>

        <Panel name="MeetingTemplates" note="the five standing meetings to copy from, and one of the producer's own">
          <MeetingTemplates c={meetingTemplatesFor('he')} own={fixtureMeetingTemplates} />
        </Panel>

        <Panel name="Insights" note="funnel, sources, cash and response, stacked as the real page stacks them">
          <div className="space-y-5">
            <FunnelChart funnel={fixtureFunnel} />
            <Sources rows={fixtureSources} />
            <CashPanel cash={fixtureCash} />
            <ResponsePanel r={fixtureResponse} />
          </div>
        </Panel>

        <Panel name="Anniversaries" note="a year after: one greeting due this week">
          <Anniversaries items={fixtureAnniversaries} />
        </Panel>

        <Panel name="Referrals" note="who brought whom; counts and brands only">
          <Referrals rows={fixtureReferrals} siteUrl="https://example.com" mine="north1" />
        </Panel>

        <Panel name="CallsPanel" note="the follow-up queue across all leads">
          <CallsPanel calls={fixtureCalls} leads={fixtureLeads.map((l) => ({ id: l.id, name: l.full_name }))} />
        </Panel>

        <Panel name="InviteBox" note="one address attached, room for one more">
          <InviteBox clientId={client} invites={[{ id: 'iv1', email: 'noa@example.com', profile_id: 'p' }]} />
        </Panel>

        <Panel name="NewClientForm" note="the door every event enters through">
          <NewClientForm />
        </Panel>

        <Panel name="NewLeadForm" note="a lead typed in from a phone call">
          <NewLeadForm />
        </Panel>

        <Panel name="CalendarFeed" note="the subscription link; creating one needs a session">
          <CalendarFeed />
        </Panel>

        <Panel name="NumbersSheet" note="the supplier page: heads, meals, seats and both clocks">
          <NumbersSheet
            client={{ display_name: 'נועה ואיתי', event_date: new Date().toISOString().slice(0, 10), venue: 'חורשת טל' }}
            guests={fixtureSheetGuests}
            tables={fixtureSheetTables}
            day={fixtureSheetMoments}
            arrivals={fixtureSheetArrivals}
            brand={{ name: 'הפקות הצפון', tagline: 'הפקת אירועים' }}
          />
        </Panel>

        {/* The one thing a guest is ever asked to fill in. Two hundred people
            per wedding touch this and nobody had rendered it. */}
        <Panel name="RsvpForm · not yet answered" note="the choice, then the questions that only make sense after it">
          <RsvpForm
            token="demo"
            initial={{ status: '', partySize: 1, diet: 'none', note: '', responded: false }}
            copy={rsvpFor('he')}
          />
        </Panel>

        <Panel name="RsvpForm · already replied" note="a guest coming back to change their answer">
          <RsvpForm
            token="demo"
            initial={{ status: 'attending', partySize: 3, diet: 'vegan', note: 'נגיע קצת אחרי החופה', responded: true }}
            copy={rsvpFor('he')}
          />
        </Panel>

        <Panel name="GuestSite" note="the page the couple sends everyone: whose, when, where, how, what, and the reply">
          <div className="-mx-4 overflow-hidden rounded-xl2 border border-line sm:-mx-8">
            <GuestSiteView
              token="0123456789abcdef0123456789abcdef"
              locale={locale}
              c={guestSiteFor(locale)}
              site={{
                event_name: 'נועה ואיתי',
                event_date: new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10),
                venue: 'חורשת טל, קיבוץ הגושרים',
                note: 'חניה חופשית בכניסה לחורשה. הערב מתחיל בשבע, החופה בשמונה וחצי, ואחריה רוקדים עד שנופלים.\nקוד לבוש: חגיגי ונוח, הדשא אמיתי.',
                producer: 'הפקות הצפון',
                moments: [
                  { at: '19:00:00', title: 'קבלת פנים' },
                  { at: '20:30:00', title: 'חופה' },
                  { at: '21:30:00', title: 'ישיבה לארוחה' },
                ],
              }}
            />
          </div>
        </Panel>

        <Panel name="GuestSiteLink · client" note="the couple's card once the page is on: share first, copy second">
          <div className="max-w-2xl"><GuestSiteLink token="0123456789abcdef0123456789abcdef" /></div>
        </Panel>

        <Panel name="GuestSiteCard · producer" note="the switch on the guests tab, with the note and the link">
          <GuestSiteCard clientId={client} token="0123456789abcdef0123456789abcdef" on note="חניה חופשית בכניסה לחורשה." />
        </Panel>

        <Panel name="BrandEditor" note="the branding screen; type a dot into the short name and watch it answer">
          <BrandEditor
            rootDomain=""
            fields={{
              brandName: 'הפקות הצפון', tagline: 'הפקת אירועים', accent: 'slate', whatsapp: '',
              bookingUrl: '', slug: 'eden.haimov.events', domain: null, logoUrl: null,
            }}
          />
        </Panel>

        <Panel name="ProducerLinkCard" note="the link a producer sends couples: their front door on the platform's address">
          <div className="grid max-w-3xl gap-4">
            <ProducerLinkCard slug="north" />
            <ProducerLinkCard slug={null} />
          </div>
        </Panel>

        <Panel name="AppShell · producer" note="the rail: account row under the mark, never behind the floating button">
          <div className="overflow-hidden rounded-xl2 border border-line">
            <AppShell
              account={{
                id: FIXTURE_VIEWER, email: 'producer@example.com', fullName: 'הפקות הצפון', avatarUrl: null,
                role: 'super_admin',
                producer: {
                  id: 'p1', brandName: 'הפקות הצפון', status: 'approved', accent: 'slate', logoUrl: null,
                  tagline: 'הפקת אירועים', whatsapp: '', slug: null, domain: null, iconUrl: null, coverUrl: null,
                },
              } as Account}
              notices={[
                { id: 'n1', kind: 'lead', title: 'פנייה חדשה מהאתר', body: 'רוני ועומר', href: '/app/leads', read_at: null, created_at: new Date().toISOString() },
              ] as never}
              brand={{ name: 'הפקות הצפון', tagline: 'הפקת אירועים', logoUrl: null, iconUrl: null, coverUrl: null, whatsapp: '', bookingUrl: '', accent: accentByKey('teal'), isPlatform: false }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary">שמירה</button>
                <button type="button" className="btn-ghost">ביטול</button>
                <span className="eyebrow">האקסנט של המפיק, על הכפתור ועל הקיקר</span>
              </div>
              <div className="skeleton mt-6 h-32 w-full" />
            </AppShell>
          </div>
        </Panel>

        {/* The other side of the same shell, which nobody had ever looked at.
            Two destinations rather than nine, a quieter ground, and the
            couple's own assistant in the corner — their producer's voice,
            never the platform's. Its copy follows the page's language. */}
        <Panel name="AppShell · couple" note="the couple's chrome: two destinations, and their own assistant in the corner">
          <div className="overflow-hidden rounded-xl2 border border-line">
            <AppShell
              account={{
                id: FIXTURE_VIEWER, email: 'couple@example.com', fullName: 'נועה ואיתי', avatarUrl: null,
                role: 'client', producer: null,
              } as Account}
              notices={[] as never}
              locale={locale}
              brand={{ name: 'הפקות הצפון', tagline: 'הפקת אירועים', logoUrl: null, iconUrl: null, coverUrl: null, whatsapp: '', bookingUrl: '', accent: accentByKey('teal'), isPlatform: false }}
            >
              <div className="skeleton h-32 w-full" />
            </AppShell>
          </div>
        </Panel>

        {/* The console row nobody could look at, because /app/admin is root
            only and behind a real session. The decision under it is the one
            this screen exists for: an account is guessed to be a producer on
            sign-up, and about half those guesses are wrong. */}
        <Panel name="Admin · one account" note="a sign-up waiting to be decided, and the same account once it was decided a couple">
          <ul className="list-none space-y-3 p-0">
            <AdminRow p={{
              id: 'p-1', brand: 'שיר', email: 'shir.aeo@gmail.com', status: 'pending',
              lastSeen: '2026-09-08T07:00:00.000Z', eventsLive: 0, eventsTotal: 0,
              leadsTotal: 0, leads30d: 0, signedTotal: 0, isRoot: false,
              ownerId: FIXTURE_VIEWER, ownerRole: 'producer', ownerKind: 'producer',
            }} />
            {/* The second state, which is the one that read as a broken
                button: an account already decided a couple. The approve and
                reject buttons are gone, because there is no production
                business to approve, and the choice it is on is marked. */}
            <AdminRow p={{
              id: 'p-2', brand: 'דני דנדוש', email: 'dani@example.com', status: 'rejected',
              lastSeen: '2026-09-07T07:00:00.000Z', eventsLive: 0, eventsTotal: 0,
              leadsTotal: 0, leads30d: 0, signedTotal: 0, isRoot: false,
              ownerId: FIXTURE_CLIENT, ownerRole: 'client', ownerKind: 'diy',
            }} />
          </ul>
        </Panel>

        {/* The two things a supplier needs and a WhatsApp thread never
            carries: a face with a name on it, and the references that
            otherwise arrive as a screenshot of a screenshot. */}
        {/* The comparison a couple cannot make on their own. The four halls
            here are quoted the four ways halls quote, on purpose: the one with
            the dearest plate is not the dearest evening, which is the entire
            reason this screen exists. */}
        <Panel name="VenueCompare" note="four quotes in four shapes, made into one number each">
          <VenueCompare
            c={venuesFor(locale)} clientId={client}
            venues={fixtureVenues} quoteUrls={{}} guestEstimate={250}
          />
        </Panel>

        <Panel name="VenueCompare · nothing toured yet" note="what it says before the first hall is added">
          <VenueCompare
            c={venuesFor(locale)} clientId={client}
            venues={[]} quoteUrls={{}} guestEstimate={0}
          />
        </Panel>

        <Panel name="PrepSheet" note="who not to miss, the looks, and one scoped link per supplier">
          <PrepSheet
            c={prepCopy} clientId={client}
            vips={fixtureVips} looks={fixtureLooks} shares={fixtureShares}
            siteUrl="https://app.liverproductions.com"
          />
        </Panel>

        {/* The same panel, in the couple's own area and their own language.
            One component and not two: they are looking at the same rows from
            the other side, and a read-only copy of this would send them back
            to WhatsApp to have a name corrected. */}
        <Panel name="PrepSheet · the couple's panel" note="the couple's language, the same rows, the same panel">
          <PrepSheet
            c={prepFor(locale)} clientId={client}
            vips={fixtureVips} looks={fixtureLooks} shares={fixtureShares}
            siteUrl="https://app.liverproductions.com"
          />
        </Panel>

        {/* What the supplier's link opens. Unreachable from here with a real
            token, and the state that matters is the populated one: a
            photographer standing in a hall reading it once on a phone. */}
        <Panel name="PrepView · the supplier's link" note="no account, no navigation, names under faces">
          <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
            <PrepView
              c={prepViewFor(locale)}
              eventName="נועה ואיתי"
              dateLabel="שבת, 5 בדצמבר 2026"
              venue="אחוזת הכפר"
              producer="ברק ליור"
              faces={fixtureVips.map((v) => ({ name: v.name, relation: v.relation, note: v.note, url: v.url }))}
              looks={fixtureLooks.map((l) => ({ category: l.category, note: l.note, url: l.url }))}
            />
          </div>
        </Panel>

        <Panel name="BrandAssets" note="the three pictures, each with its rules beside the button; one already uploaded">
          <BrandAssets urls={{ logo: null, icon: fixtureMedia[1].url, cover: fixtureMedia[0].url }} />
        </Panel>

        <Panel name="MediaVault · producer" note="the shared folder with pictures: four tags, one untagged, manage mode and the lightbox">
          <EventFiles clientId={client} files={[...fixtureMedia, ...fixtureFiles]} viewer="producer" />
        </Panel>

        <Panel name="VendorImport" note="the sheet importer before a file is chosen: template, drop zone">
          <VendorImport existingNames={['סטודיו לביא']} />
        </Panel>

        <Panel name="HebrewCalendar" note="the Three Weeks of 5786: seventeen Tammuz closes it, and Saturday nights stay open">
          <HebrewCalendar from="2026-06-28" />
        </Panel>

        <Panel name="HebrewCalendar · the Omer" note="closed from Pesach, one clear night at Lag BaOmer, then the Sephardi custom">
          <HebrewCalendar from="2026-04-26" />
        </Panel>

        <Panel name="EventTagPicker" note="the other end of the colours: one is on, pressing it again clears it">
          <div className="card">
            <EventTagPicker
              clientId={FIXTURE_CLIENT}
              current="t3"
              labels={[
                { id: 't1', kind: 'event_tag', label: 'חתונות פעילות', color: '#2F6F5E', sort_order: 1 },
                { id: 't2', kind: 'event_tag', label: 'פגישות זוג', color: '#7C5CBF', sort_order: 2 },
                { id: 't3', kind: 'event_tag', label: 'טעימות וסיורים', color: '#C2762B', sort_order: 3 },
                { id: 't4', kind: 'event_tag', label: 'תשלומים דחופים', color: '#2563EB', sort_order: 4 },
              ]}
            />
          </div>
        </Panel>

        <Panel name="LabelToolbar · colours" note="the producer's own diary colours; press a name to rename or recolour">
          <LabelToolbar
            kind="event_tag"
            labels={[
              { id: 't1', kind: 'event_tag', label: 'חתונות פעילות', color: '#2F6F5E', sort_order: 1 },
              { id: 't2', kind: 'event_tag', label: 'פגישות זוג', color: '#7C5CBF', sort_order: 2 },
              { id: 't3', kind: 'event_tag', label: 'טעימות וסיורים', color: '#C2762B', sort_order: 3 },
              { id: 't4', kind: 'event_tag', label: 'תשלומים דחופים', color: '#2563EB', sort_order: 4 },
            ]}
          />
        </Panel>

        <Panel name="LabelToolbar · channels" note="the six the platform ships, dashed, beside two the producer added">
          <LabelToolbar
            kind="lead_channel"
            labels={[
              { id: 'c1', kind: 'lead_channel', label: 'טיקטוק', color: '#B03A5B', sort_order: 1 },
              { id: 'c2', kind: 'lead_channel', label: 'המלצה ממעצב', color: '#0E7490', sort_order: 2 },
            ]}
            builtIn={['שיחת טלפון', 'וואטסאפ', 'אינסטגרם', 'פייסבוק', 'המלצה', 'הגיעו אלינו']}
          />
        </Panel>

        <Panel name="QuickJump" note='⌘K opens it. Empty: recents, menu, then what is coming. Typed: try "רוני כסף", or "משימות" on its own'>
          <div className="flex justify-end rounded-xl2 border border-line bg-card p-3">
            <QuickJump
              screens={[
                { href: '/app', label: 'סקירה', icon: 'overview' },
                { href: '/app/leads', label: 'לידים', icon: 'leads' },
                { href: '/app/clients', label: 'אירועים', icon: 'clients' },
                { href: '/app/vendors', label: 'ספקים', icon: 'vendors' },
              ]}
              records={[
                { kind: 'lead', id: 'l1', name: 'שירה ואורי', note: '050-1234567', href: '/app/leads#lead-l1' },
                { kind: 'lead', id: 'l2', name: 'משפחת אזולאי', note: '052-7654321', href: '/app/leads#lead-l2' },
                { kind: 'vendor', id: 'v1', name: 'קייטרינג הדר', note: 'קייטרינג', href: '/app/vendors#vendor-v1' },
                { kind: 'vendor', id: 'v2', name: 'תאורת שדה', note: 'תאורה והגברה', href: '/app/vendors#vendor-v2' },
              ]}
              events={[
                /* One finished event, to show that it sorts below the ones that
                   have not happened yet rather than above them. */
                { id: '00000000-0000-4000-8000-000000000004', name: 'הילה ויונתן', date: '2025-08-30' },
                { id: FIXTURE_CLIENT, name: 'נועה ואיתי', date: '2026-10-18' },
                { id: '00000000-0000-4000-8000-000000000002', name: 'רוני ועומר', date: '2026-11-05' },
                { id: '00000000-0000-4000-8000-000000000003', name: 'כנס שנתי, טבע', date: null },
              ]}
            />
          </div>
        </Panel>

        <Panel name="NoticeBell" note="the bell with three unread; open it">
          <div className="flex justify-end rounded-xl2 border border-line bg-card p-3">
            <NoticeBell notices={[
              { id: 'n1', kind: 'lead', title: 'פנייה חדשה מהאתר', body: 'רוני ועומר, חתונה ביוני', href: '/app/leads', read_at: null, created_at: new Date(Date.now() - 4 * 60_000).toISOString() },
              { id: 'n2', kind: 'rsvp', title: 'אישור הגעה', body: 'משפחת כהן, 4 מגיעים', href: '/app/clients', read_at: null, created_at: new Date(Date.now() - 3 * 3_600_000).toISOString() },
              { id: 'n3', kind: 'ticket', title: 'עדן חיימוב', body: 'הכפתור של השמירה לא מגיב במסך המיתוג', href: '/app/admin/tickets', read_at: null, created_at: new Date(Date.now() - 26 * 3_600_000).toISOString() },
              { id: 'n4', kind: 'payment', title: 'תשלום התקבל', body: 'מקדמה, נועה ואיתי', href: '/app/clients', read_at: new Date().toISOString(), created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
            ]} />
          </div>
        </Panel>

        <Panel name="IssueReporter" note="the bug button; the sheet it opens captures the route and the browser itself">
          <div className="flex justify-end rounded-xl2 border border-line bg-card p-3">
            <IssueReporter userId={FIXTURE_VIEWER} />
          </div>
        </Panel>

        {/* The chat dock, worn by the assistant with the most on it: an event
            in the header, what the answer was read from, and a copy row under
            every answer. The couple's is the same panel with fewer props, and
            it is mounted by the couple's shell below.

            One of these rather than two. The producer's shell above mounts its
            own, and a second copy of a fixed button lands on the first pixel
            for pixel, so the one underneath could not be pressed at all. */}
        <Panel name="ProducerCopilot" note="the shared chat dock, fully dressed; its button floats in the corner">
          <p className="text-[13px] text-ink-mute">הכפתור צף בפינת המסך, ומגיע מהמעטפת של המפיק שלמעלה. פותחים אותו ומקבלים את הפתיח וההצעות; תשובה אמיתית דורשת מפתח API.</p>
        </Panel>

        <Panel name="Loading · console" note="what a tap on the navigation shows before the server answers">
          <ConsoleLoading />
        </Panel>

        <Panel name="Loading · event file" note="between one tab and the next">
          <EventLoading />
        </Panel>

        <Panel name="Loading · portal" note="the couple's area, the countdown's space first">
          <div className="max-w-3xl"><PortalLoading /></div>
        </Panel>

        <Panel name="BeginHere" note="a fresh producer's overview: the first steps instead of 'all clear'">
          <div className="max-w-xl"><BeginHere /></div>
        </Panel>

        <Panel name="GuideBook · client" note="the couple's operating book, in the page's language">
          <GuideBookView book={clientGuideFor(locale)} c={guideUiFor(locale)} />
        </Panel>

        <Panel name="GuideBook · producer" note="the console's book, Hebrew only like the console">
          <GuideBookView book={producerGuide} c={guideUiFor('he')} />
        </Panel>

        {/* ── the panels that had never been looked at ─────────────────────
            Two thirds of this file's components were here and a third were
            not, and nothing said so. Every bug this harness has ever caught
            was in something somebody thought to add; the ones nobody thought
            to add were the ones nobody could see. */}

        <Panel name="PortalSummary" note="the four numbers a couple opens the app for, one closed module hidden">
          <div className="max-w-2xl">
            <PortalSummary
              label={ui.portal.title}
              rows={summaryRows({
                budget: 148000, owed: 32000, openTasks: 9,
                attending: 96, invited: 180, tables: 18,
                contracts: 2, venues: 3, files: 5, saved: 12, vendors: 7, meetings: 1,
                envelopes: 3, vehicles: 2,
                can: (key) => key !== 'seating',
                c: ui.portal,
              })}
            />
          </div>
        </Panel>

        <Panel name="EventTabs" note="fourteen sections on a phone: one row that scrolls, cut off on purpose">
          <EventTabs clientId={client} active="prep" counts={{ tasks: 4, guests: 180, money: 2 }} />
        </Panel>

        <Panel name="EventDetails" note="the event's own facts, with the enquiry's contact carried across">
          <EventDetails event={{
            id: client, display_name: 'נועה ואיתי', kind: 'wedding',
            event_date: '2026-12-05', venue: 'אחוזת הכפר', guest_estimate: 180,
            contact_email: 'noa@example.com', contact_phone: '0521234567',
          }} />
        </Panel>

        <Panel name="EventVendors" note="the suppliers on one event, and the directory they are picked from">
          <EventVendors
            clientId={client}
            vendors={[
              { id: 'ev1', vendor_id: 'v1', name: 'סטודיו לביא', category: 'צילום', phone: '0521111111', status: 'booked', call_time: '15:30', notes: 'מגיע עם שני צלמים' },
              { id: 'ev2', vendor_id: null, name: 'להקת שדות', category: 'מוזיקה', phone: '0522222222', status: 'shortlist', call_time: null, notes: '' },
            ]}
            directory={fixtureVendors.map((v) => ({ id: v.id, name: v.name, category: v.category, phone: v.phone }))}
          />
        </Panel>

        <Panel name="ApplyTemplate" note="a template onto an event that has a date, so the offsets mean something">
          <div className="max-w-xl"><ApplyTemplate clientId={client} templates={fixtureTemplates} hasDate /></div>
        </Panel>

        <Panel name="EventTemplate" note="saving this event's own plan back as a template">
          <div className="max-w-xl"><EventTemplate clientId={client} /></div>
        </Panel>

        <Panel name="GuestImport" note="a guest list pasted out of somebody's mother's Word document">
          <div className="max-w-2xl"><GuestImport clientId={client} /></div>
        </Panel>

        <Panel name="MediaVault · client" note="the same pictures the couple sees: no manage mode, no delete">
          <MediaVault clientId={client} photos={fixtureMedia} viewer="client" />
        </Panel>

        <Panel name="ReceiptScan" note="a photograph of a receipt becoming a budget line">
          <div className="max-w-md"><ReceiptScan clientId={client} formId="design-receipt" /></div>
        </Panel>

        <Panel name="SignLink" note="the link that lets one side sign without an account">
          <div className="max-w-md">
            <SignLink contractId="00000000-0000-4000-8000-0000000000c1" clientId={client} party="נועה" />
          </div>
        </Panel>

        <Panel name="CodeInput" note="six boxes for a sign-in code, one caret, paste lands in all of them">
          <div className="max-w-sm"><CodeInput name="code" label="הקוד שנשלח" length={6} /></div>
        </Panel>

        <Panel name="FeatureFlags" note="which modules each kind of couple may open; two axes, not one switch">
          <div className="max-w-xl">
            <FeatureFlags flags={[
              { key: 'budget', label: 'תקציב', diy: true, managed: true },
              { key: 'guests', label: 'אורחים ו-RSVP', diy: true, managed: true },
              { key: 'messages', label: 'הודעות עם המפיק', diy: false, managed: true },
              { key: 'prep', label: 'פנים והשראה', diy: true, managed: true },
            ]} />
          </div>
        </Panel>

        <Panel name="SiteEditor" note="the public site's words, with one field already overridden">
          <div className="max-w-2xl">
            <SiteEditor
              values={{ 'hero.title': 'הפקות ליאור', 'hero.sub': 'אירועים שנזכרים', 'contact.phone': '050-0000000' }}
              overridden={new Set(['hero.sub'])}
            />
          </div>
        </Panel>

        <Panel name="StoreProducts" note="what the producer sells, one item switched off">
          <StoreProducts
            producerId="00000000-0000-4000-8000-00000000000f"
            products={[
              { id: 'p1', name: 'ליווי מלא', blurb: 'מהפגישה הראשונה עד הבוקר שאחרי', body: '', price: 24000, kind: 'service', image_path: '', active: true },
              { id: 'p2', name: 'יום האירוע בלבד', blurb: 'ניהול שטח מ-08:00', body: '', price: 9000, kind: 'service', image_path: '', active: false },
            ]}
          />
        </Panel>

        <Panel name="SopBook" note="the operating book with its own search, opened from the console">
          <div className="max-w-2xl"><SopBook /></div>
        </Panel>

        {/* Both of these are `position: fixed` on a real screen. A transform
            makes this box their containing block, so they sit inside the
            panel here instead of floating over the whole harness — the same
            pixels, somewhere they can be looked at. */}
        <Panel name="Metric" note="one figure at both sizes, the five tones, and a block with rows under it">
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-10">
              <Metric size="lead" kicker="נכנס החודש" value={<Money value={148000} />} sub="שלושה תשלומים" />
              <Metric kicker="אישרו הגעה" value={<Ratio of={96} total={180} />} tone="ok" />
              <Metric kicker="באיחור" value={2} tone="bad" sub={<Money value={19000} />} href="#" label="לפירוט" />
              <Metric kicker="קרוב לתאריך" value={5} tone="warn" />
              <Metric kicker="בטיוטה" value={3} tone="accent" />
            </div>
            <MetricBlock
              kicker="תקציב האירוע" value={<Money value={148000} />} sub={<>מתוך <Money value={160000} /></>}
              rows={[
                { label: 'שולם', value: <Money value={92000} />, tone: 'ok' },
                { label: 'פתוח', value: <Money value={37000} /> },
                { label: 'באיחור', value: <Money value={19000} />, tone: 'bad' },
              ]}
            />
            <MetricRows rows={[
              { label: 'מוזיקה', value: <Money value={12000} /> },
              { label: 'צילום', value: <Money value={18500} /> },
              { label: 'עיצוב', value: <Money value={9000} />, tone: 'accent' },
            ]} />
          </div>
        </Panel>

        {/* The header every screen in the workspace wears, and the sentence
            under an empty one. Both were shipped on nineteen screens and had
            never been looked at on their own. */}
        <Panel name="PageHead · Empty" note="a screen's first two lines, then what a screen with nothing in it says">
          <div className="max-w-2xl">
            <PageHead title="ספקים" sub="מי סוגר את מה, ומתי הם מגיעים." />
            <Empty text="עוד לא הוספתם ספק לאירוע הזה." />
          </div>
        </Panel>

        {/* The line above a screen where a read failed. It renders on almost
            no morning, which is exactly why it had never been seen: the state
            it exists for is the one nobody can reproduce on purpose. */}
        <Panel name="LoadTrouble" note="what sits above a screen whose data half arrived">
          <div className="max-w-2xl"><TroubleLine text={ui.loadTrouble} /></div>
        </Panel>

        {/* What a write that did not happen says. Sixteen server actions used
            to log the failure and redraw the screen exactly as it was. */}
        <Panel name="Flash" note="the sentence an action leaves behind: a write that did not happen, and one whose effect is elsewhere">
          <div className="max-w-2xl space-y-3">
            <FlashLine text="הקישור לא בוטל. הוא עדיין פעיל. אפשר לנסות שוב." />
            <FlashLine text="לא הצלחנו להזיז את השורה. אפשר לנסות שוב." />
            {/* The quiet one. For the few writes that land somewhere the
                screen cannot show, where silence reads as a dead button. */}
            <FlashLine tone="ok" text="נרשמו כזוג שמתכנן לבד, ונפתח להם מרחב עבודה משלהם." />
          </div>
        </Panel>

        <Panel name="Avatar" note="initials when there is no picture, which is almost always">
          <div className="flex items-center gap-4">
            <Avatar name="נועה בן דוד" />
            <Avatar name="איתי" size={48} />
            <Avatar name="Sarah Cohen" size={28} />
            <Avatar name="" size={36} />
          </div>
        </Panel>

        <Panel name="ArchiveButton" note="both directions: an open event, and one already put away">
          <div className="flex flex-wrap gap-3">
            <ArchiveButton clientId={client} archived={false} />
            <ArchiveButton clientId={client} archived />
            <ArchiveButton clientId={client} archived={false} highlight />
            <PrintButton label="הדפסה" />
          </div>
        </Panel>

        <Panel name="RegionPicker" note="six chips and a free field, because the seventh region always exists">
          <div className="max-w-md">
            <RegionPicker
              name="region" regions={REGIONS.map((r) => ({ value: r, label: r }))}
              label="איפה האירוע" freeLabel="מקום אחר" freePh="לכתוב איפה"
            />
          </div>
        </Panel>

        <Panel name="Ltr · Money · Ratio · PromiseLine" note="a number inside a Hebrew sentence, which is where bidi goes wrong">
          <div className="max-w-xl space-y-2 text-[15px] text-ink">
            <p>נכנסו <Money value={148000} /> מתוך התקציב.</p>
            <p>אישרו הגעה <Ratio of={96} total={180} />.</p>
            <p>הטלפון של הצלם הוא <Ltr>052-111-1111</Ltr> והמייל <Ltr>studio@example.com</Ltr>.</p>
            <PromiseLine />
          </div>
        </Panel>

        <Panel name="PortalActions · CoupleCompanion" note="the three things that float over the couple's area, contained so they can be seen">
          <div className="relative h-[26rem] overflow-hidden rounded-xl2 border border-line bg-surface [transform:translate(0)]">
            <PortalActions
              producerName="הפקות ליאור"
              phone="0500000000"
              whatsapp="0500000000"
              bookingUrl="https://example.com/booking"
              onReport={async () => {
                'use server';
                return { ok: true };
              }}
            />
            <CoupleCompanion copy={companionFor(locale)} />
          </div>
        </Panel>

        <Panel name="EventSelector" note="a couple with more than one celebration: which list they are looking at, and the way to open another">
          <EventSelector
            clientId="00000000-0000-4000-8000-000000000003"
            selectedId="00000000-0000-4000-8000-000000000001"
            labels={{ add: ui.portal.eventAdd, empty: ui.portal.eventPick }}
            events={[
              {
                id: '00000000-0000-4000-8000-000000000001',
                client_id: '00000000-0000-4000-8000-000000000003',
                event_type: 'wedding', display_name: 'החתונה',
                event_date: '2026-12-05', location: 'אחוזת הכפר',
              },
              {
                id: '00000000-0000-4000-8000-000000000005',
                client_id: '00000000-0000-4000-8000-000000000003',
                event_type: 'henna', display_name: 'חינה',
                event_date: '2026-11-28', location: 'בית ההורים',
              },
              {
                id: '00000000-0000-4000-8000-000000000006',
                client_id: '00000000-0000-4000-8000-000000000003',
                event_type: 'groom_party', display_name: 'שבת חתן',
                event_date: null, location: '',
              },
            ]}
          />
        </Panel>

        <Panel name="EnvelopesPanel" note="the cash for the night: who each envelope is for, how much, and the one already handed over">
          <EnvelopesPanel
            c={envelopesFor(locale)}
            clientId="00000000-0000-4000-8000-000000000003"
            items={[
              { id: 'e1', label: 'רב', amount: 1500, recipient: 'הרב כהן', cash: true, delivered_at: '2026-12-05T18:40:00Z', note: 'אחרי החופה' },
              { id: 'e2', label: 'טיפ לצוות', amount: 800, recipient: '', cash: true, delivered_at: null, note: '' },
              { id: 'e3', label: 'צלם, יתרה', amount: 4200, recipient: 'יוסי', cash: false, delivered_at: null, note: 'העברה ביום שאחרי' },
            ]}
          />
        </Panel>

        <Panel name="VehiclesPanel" note="how everybody gets to the hall and home: a name the couple chose, whose car, seats, who rides">
          <VehiclesPanel
            c={vehiclesFor(locale)}
            clientId="00000000-0000-4000-8000-000000000003"
            items={[
              { id: 'v1', name: 'רכב 1', driver: 'אבא של נועה', phone: '0501234567', seats: 4, riders: 'סבתא, דודה רחל, שני הילדים', leg: 'both', note: 'יוצאים ב-16:30 מהבית' },
              { id: 'v2', name: 'הסעה מהצפון', driver: 'חברת ההסעות', phone: '0529876543', seats: 20, riders: 'החברים מחיפה', leg: 'to', note: '' },
            ]}
          />
        </Panel>

        <Panel name="VendorCaptureModal" note="what opens when a supplier task is ticked: the form that catches who was hired, and for how much">
          <div className="relative h-[34rem] overflow-hidden rounded-xl2 border border-line bg-surface [transform:translate(0)]">
            <VendorCaptureDemo />
          </div>
        </Panel>
      </main>
    </CopyProvider>
  );
}
