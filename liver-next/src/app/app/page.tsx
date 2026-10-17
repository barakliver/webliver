import { fill } from '@/lib/copyText';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { requireAccount, isLive } from '@/lib/auth';
import { getOverview } from '@/lib/attention';
import { Live } from '@/components/app/Live';
import { serverCopy, currentLocale } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { AttentionList } from '@/components/app/Attention';
import { SeasonColumn, LeadFigures, MoneyBars } from '@/components/app/Desk';
import { Anniversaries } from '@/components/app/Anniversaries';
import { supabaseServer } from '@/lib/supabase/server';
import { loadAnniversaries } from '@/lib/workflow';
import { BeginHere } from '@/components/app/BeginHere';
import { IssueReporter } from '@/components/app/IssueReporter';
import { MyTasks } from '@/components/app/MyTasks';
import { Fold } from '@/components/Fold';
import { FoldReveal } from '@/components/portal/FoldReveal';
import { loadMyTasks } from '@/lib/producerTasksLoad';
import { todayInZone } from '@/lib/clock';

export async function generateMetadata() {
  return { title: (await serverCopy()).nav.overview };
}


export default async function OverviewPage() {
  const ui = await serverCopy();
  const c = (await serverCopy()).overview2;
  const account = await requireAccount();
  if (account.role === 'client') redirect('/app/portal');
  if (account.role === 'staff') redirect('/app/shifts');
  if (!isLive(account)) redirect('/app/pending');

  const { items, money, season, leads } = await getOverview();
  const locale = await currentLocale();
  const first = account.fullName.split(' ')[0];

  /* Renders nothing at all when there is none, which is most mornings. A panel
     that is present and empty on a screen built around what needs a decision
     is a panel that trains people to skip that column. */
  const sb = await supabaseServer();
  const anniversaries = await loadAnniversaries(sb);

  /* His own list. Read here rather than inside the component so the screen
     arrives whole: a panel that fetches after it mounts is a panel that
     flashes empty on every visit, and this one is read every morning. */
  const myTasks = await loadMyTasks(sb);

  /* A producer with no events yet is not "all clear", they are before the
     beginning. The head count is enough to know which of the two mornings
     this is, and it costs a header, not a row. */
  const { count } = await sb.from('clients').select('id', { count: 'exact', head: true });
  const fresh = (count ?? 0) === 0;

  /* The morning in one line under the greeting, from the plum design: how
     many are open, how many leads wait, how many payments are late. A part
     whose number is zero is left out rather than said, and a quiet morning
     keeps its own sentence. */
  const late = items.filter((i) => i.kind === 'payment').length;
  const summary = [
    season.length ? (season.length === 1 ? c.sumEventsOne : fill(c.sumEvents, { n: season.length })) : null,
    leads.unanswered ? (leads.unanswered === 1 ? c.sumLeadsOne : fill(c.sumLeads, { n: leads.unanswered })) : null,
    late ? (late === 1 ? c.sumLateOne : fill(c.sumLate, { n: late })) : null,
  ].filter(Boolean).join(' \u00B7 ');
  const sub = summary || (items.length ? undefined : c.clearSub);

  return (
    <>
      <PageHead
        /* The name in its own direction: "שלום barak" reordered the Latin
           name to the wrong side of the greeting without the isolate. */
        title={first ? <>{ui.overview.greeting} <bdi>{first}</bdi></> : ui.overview.greeting}
        sub={sub ? <span className="write-in block">{sub}</span> : undefined}
        report={<IssueReporter userId={account.id} context={ui.overview.greeting} />}
      />

      {/* The plum desk: three columns where there is room for three, his
          morning first, the season beside it, the leads and the money after.
          Two columns on a laptop with the third under the first, one on a
          phone in the same order. Nothing that was on this screen is gone:
          the next event is the filled circle at the top of the season, and
          the money keeps its three ways in. */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] xl:grid-cols-[5fr_4fr_3fr] xl:gap-6">
        <section aria-labelledby="needs-you" className="min-w-0 space-y-5">
          {/* First, because it is his. */}
          <MyTasks tasks={myTasks} today={todayInZone()} />

          {fresh && items.length === 0 ? (
            /* The book's own first steps, on the first screen of the first
               visit, so nobody has to find the book to learn there is an
               order. The heading id stays: it is the same slot on the page,
               holding the version of "what needs you" that a beginning has. */
            <div>
              <h2 id="needs-you" className="eyebrow mb-3">{c.begin.eyebrow}</h2>
              <BeginHere />
            </div>
          ) : (
            /* His own list first and open, the clients' pile under it behind
               a row. It was the other way round, and he turned it over: what
               he opens this screen to do is his own morning, and the pile is
               everybody else's. The count rides on the row, so a folded pile
               still says how much is in it. */
            <Fold
              id="fold-clients"
              icon={Inbox}
              count={items.length}
              title={c.needsYou}
              sub={items.length === 1 ? c.needsYouOne : fill(c.needsYouSub, { n: items.length })}
            >
              <AttentionList items={items} />
            </Fold>
          )}
        </section>

        {season.length > 0 && (
          <div className="min-w-0">
            <SeasonColumn
              events={season}
              dateLocale={locale === 'en' ? 'en-GB' : 'he-IL'}
              copy={{
                season: c.season, seasonN: c.seasonN, seasonOne: c.seasonOne, noDate: c.noDate,
                daysN: c.daysN, today: c.inDays.today, tomorrow: c.inDays.tomorrow,
                production: ui.statusBoard.serviceProduction, management: ui.statusBoard.serviceManagement,
                allClients: c.allClients,
              }}
            />
          </div>
        )}

        <div className="grid min-w-0 content-start gap-5">
          <Anniversaries items={anniversaries} />
          <LeadFigures
            stats={leads}
            copy={{ leads: c.leads, leadsWeek: c.leadsWeek, leadsMeeting: c.leadsMeeting, leadsHours: c.leadsHours, unknown: c.unknown, allLeads: c.allLeads }}
          />
          <MoneyBars money={money} copy={{ money: c.money, paid: c.paid, owed: c.owed, overdue: c.overdue }} />
        </div>
      </div>
      {/* A link into the folded pile opens it on the way. */}
      <FoldReveal />
      <Live sources={[{ table: 'leads' }, { table: 'tasks' }, { table: 'payments' }, { table: 'clients' }, { table: 'producer_tasks' }]} />
    </>
  );
}
