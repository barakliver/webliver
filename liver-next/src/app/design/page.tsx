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
  fixtureSeatGuests, fixtureDay, fixtureMessages, fixtureContracts, fixtureFiles, fixtureMedia,
  fixtureSongs, fixtureKit, fixturePeople, fixtureBoard, fixtureShopItems,
  fixtureStatus, fixtureAttention, fixtureOrders, fixtureShelf, fixtureCrew,
  fixtureLeads, fixtureCalls, fixtureVendors,
  fixtureAnniversaries, fixtureEventSummary, fixtureFunnel, fixtureSources,
  fixtureResponse, fixtureCash, fixtureReferrals, fixtureTemplates,
  fixtureMeetings, fixtureDayLines, fixtureDayCrew, fixtureDayVendors,
  fixtureSheetGuests, fixtureSheetTables, fixtureSheetMoments, fixtureSheetArrivals,
} from '@/content/fixtures';
import { NumbersSheet } from '@/components/app/NumbersSheet';
import { GuestSiteView } from '@/components/guest/GuestSiteView';
import { GuestSiteLink } from '@/components/app/GuestSiteLink';
import { GuestSiteCard } from '@/components/app/GuestSiteCard';
import { guestSiteFor } from '@/content/ui';
import { AppShell } from '@/components/app/AppShell';
import { ProducerLinkCard } from '@/components/app/ProducerLinkCard';
import { BrandEditor } from '@/components/app/BrandEditor';
import { BrandAssets } from '@/components/app/BrandAssets';
import { NoticeBell } from '@/components/app/NoticeBell';
import { IssueReporter } from '@/components/app/IssueReporter';
import { VendorImport } from '@/components/app/VendorImport';
import { ProducerCopilot } from '@/components/app/ProducerCopilot';
import { QuickJump } from '@/components/app/QuickJump';
import { FinanceSummary } from '@/components/app/FinanceSummary';
import { HebrewCalendar } from '@/components/app/HebrewCalendar';
import { LabelToolbar } from '@/components/app/LabelToolbar';
import { EventTagPicker } from '@/components/app/EventTagPicker';
import { accentByKey } from '@/content/brand';
import type { Account } from '@/lib/auth';
import ConsoleLoading from '@/app/app/loading';
import EventLoading from '@/app/app/clients/[id]/loading';
import PortalLoading from '@/app/app/portal/loading';

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
                role: 'super_admin', clientIds: [],
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

        <Panel name="ProducerCopilot" note="the floating assistant; the button sits fixed at the end edge of this page">
          <ProducerCopilot brandName="הפקות הצפון" />
          <p className="text-[13px] text-ink-mute">הכפתור צף בפינת המסך. פותחים אותו ומקבלים את הפתיח וארבע ההצעות; שליחה דורשת מפתח API.</p>
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
      </main>
    </CopyProvider>
  );
}
