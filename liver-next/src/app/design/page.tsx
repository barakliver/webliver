import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { currentLocale } from '@/lib/serverLocale';
import { TaskList } from '@/components/app/TaskList';
import { PaymentsPanel } from '@/components/app/PaymentsPanel';
import { BudgetPanel } from '@/components/app/BudgetPanel';
import { GuestList } from '@/components/app/GuestList';
import { SeatingPlan } from '@/components/app/SeatingPlan';
import { DaySchedule } from '@/components/app/DaySchedule';
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
import { DayOfCockpit } from '@/components/app/DayOfCockpit';
import { CallsPanel } from '@/components/app/CallsPanel';
import { InviteBox } from '@/components/app/InviteBox';
import { NewClientForm } from '@/components/app/NewClientForm';
import { NewLeadForm } from '@/components/app/NewLeadForm';
import { CalendarFeed } from '@/components/app/CalendarFeed';
import {
  FIXTURE_CLIENT, FIXTURE_VIEWER,
  fixtureTasks, fixturePayments, fixtureBudget, fixtureGuests, fixtureTables,
  fixtureSeatGuests, fixtureDay, fixtureMessages, fixtureContracts, fixtureFiles,
  fixtureSongs, fixtureKit, fixturePeople, fixtureBoard, fixtureShopItems,
  fixtureStatus, fixtureAttention, fixtureOrders, fixtureShelf, fixtureCrew,
  fixtureLeads, fixtureCalls, fixtureVendors,
  fixtureAnniversaries, fixtureEventSummary, fixtureFunnel, fixtureSources,
  fixtureResponse, fixtureCash, fixtureReferrals, fixtureTemplates,
  fixtureMeetings, fixtureDayLines, fixtureDayCrew, fixtureDayVendors,
  fixtureSheetGuests, fixtureSheetTables, fixtureSheetMoments, fixtureSheetArrivals,
} from '@/content/fixtures';
import { NumbersSheet } from '@/components/app/NumbersSheet';

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
        <h2 className="font-display text-[17px] font-light text-ink">{name}</h2>
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
        <h1 className="mt-3 font-display text-display font-light text-ink">
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

        <Panel name="BudgetPanel · producer" note="an agreed figure, two still open">
          <BudgetPanel clientId={client} items={fixtureBudget} viewer="producer" visible />
        </Panel>

        <Panel name="GuestList" note="attending, declined, no answer, a six person party">
          <GuestList clientId={client} guests={fixtureGuests} />
        </Panel>

        <Panel name="SeatingPlan" note="two tables filled, one guest unseated">
          <SeatingPlan clientId={client} tables={fixtureTables} guests={fixtureSeatGuests} />
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

        <Panel name="MeetingDrawer" note="one meeting written up, one not yet held">
          <MeetingDrawer clientId={client} logs={fixtureMeetings} />
        </Panel>

        <Panel name="WorkflowTemplates" note="two templates, steps counted back from the day">
          <WorkflowTemplates templates={fixtureTemplates} />
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

        <Panel name="BeginHere" note="a fresh producer's overview: the first steps instead of 'all clear'">
          <div className="max-w-xl"><BeginHere /></div>
        </Panel>

        <Panel name="GuideBook · client" note="the couple's operating book, in the page's language">
          <GuideBookView book={clientGuideFor(locale)} c={guideUiFor(locale)} />
        </Panel>

        <Panel name="GuideBook · producer" note="the console's book, Hebrew only like the console">
          <GuideBookView book={producerGuide} c={guideUiFor('he')} />
        </Panel>
      </main>
    </CopyProvider>
  );
}
