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
import {
  FIXTURE_CLIENT, FIXTURE_VIEWER,
  fixtureTasks, fixturePayments, fixtureBudget, fixtureGuests, fixtureTables,
  fixtureSeatGuests, fixtureDay, fixtureMessages, fixtureContracts, fixtureFiles,
  fixtureSongs, fixtureKit, fixturePeople, fixtureBoard, fixtureShopItems,
} from '@/content/fixtures';

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
      </main>
    </CopyProvider>
  );
}
