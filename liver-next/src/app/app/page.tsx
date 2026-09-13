import { fill } from '@/lib/copyText';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarHeart, Wallet, ChevronLeft } from 'lucide-react';
import { requireAccount, isLive } from '@/lib/auth';
import { getOverview } from '@/lib/attention';
import { Live } from '@/components/app/Live';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { AttentionList } from '@/components/app/Attention';
import { Money, ils } from '@/components/Ltr';
import { MetricRows } from '@/components/app/Metric';
import { Anniversaries } from '@/components/app/Anniversaries';
import { supabaseServer } from '@/lib/supabase/server';
import { loadAnniversaries } from '@/lib/workflow';
import { BeginHere } from '@/components/app/BeginHere';
import { IssueReporter } from '@/components/app/IssueReporter';
import { MyTasks, MyTaskQuickAdd } from '@/components/app/MyTasks';
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
  if (!isLive(account)) redirect('/app/pending');

  const { items, next, money } = await getOverview();
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

  return (
    <>
      <PageHead
        /* The name in its own direction: "שלום barak" reordered the Latin
           name to the wrong side of the greeting without the isolate. */
        title={first ? <>{ui.overview.greeting} <bdi>{first}</bdi></> : ui.overview.greeting}
        sub={
          items.length
            ? `${items.length} ${items.length === 1 ? 'דבר מחכה' : 'דברים מחכים'} להחלטה שלך`
            : c.clearSub
        }
        report={<IssueReporter userId={account.id} context={ui.overview.greeting} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-8">
        {/* The pile, first and biggest, because it is the reason to open the
            screen at all. */}
        <section aria-labelledby="needs-you" className="min-w-0">
          {fresh && items.length === 0 ? (
            /* The book's own first steps, on the first screen of the first
               visit, so nobody has to find the book to learn there is an
               order. The heading id stays: it is the same slot on the page,
               holding the version of "what needs you" that a beginning has. */
            <>
              <h2 id="needs-you" className="eyebrow mb-3">{c.begin.eyebrow}</h2>
              <BeginHere />
            </>
          ) : (
            <>
              {/* The plus sits on this heading and not on the panel below,
                  because the thought "I have to call the lighting company
                  back" arrives while reading the pile — and a thing you have
                  to scroll to write down gets written on paper instead. */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 id="needs-you" className="eyebrow">{c.needsYou}</h2>
                <MyTaskQuickAdd />
              </div>
              <AttentionList items={items} />
            </>
          )}

          {/* His own list, under the pile and not beside it. The pile is
              things the product worked out that he should look at; this is
              the things he decided himself, which is the other half of a
              working morning and lived on paper until now. Under, because
              the pile is what is new since yesterday and this is what was
              already true. */}
          <div className="mt-8">
            <MyTasks tasks={myTasks} today={todayInZone()} showAdd={false} />
          </div>
        </section>

        <div className="grid min-w-0 content-start gap-5">
          <Anniversaries items={anniversaries} />
          {next && (
            <Link
              href={next.href}
              className="card group block transition-colors duration-200 hover:border-accent"
            >
              <div className="flex items-center gap-2 text-accent">
                <CalendarHeart size={16} strokeWidth={1.5} aria-hidden />
                <span className="eyebrow">{c.nextEvent}</span>
              </div>
              <p className="mt-3 font-display text-[24px] font-semibold leading-tight text-ink">
                {next.name}
              </p>
              <p className="mt-1 text-[14px] text-ink-soft">{next.date}</p>
              <p className="mt-4 font-display text-[32px] font-semibold leading-none text-ink">
                {next.days === 0 ? c.inDays.today : next.days === 1 ? c.inDays.tomorrow : fill(c.inDays.later, { n: next.days })}
              </p>
            </Link>
          )}

          <section className="card">
            <div className="flex items-center gap-2 text-accent">
              <Wallet size={16} strokeWidth={1.5} aria-hidden />
              <span className="eyebrow">{c.money}</span>
            </div>

            {/* Every one of these is a way in rather than a read-out. An
                amount owed is a question, and the answer is on another screen;
                until now the only way to get there was to remember where it
                was. The three do not go to the same place, which is the point:
                collected and owed are explained on the numbers screen, and
                money that is late is explained by the events carrying it. */}
            <MetricRows
              className="mt-4"
              rows={[
                { label: c.paid, value: <Money value={money.paid} />, href: '/app/insights' },
                { label: c.owed, value: <Money value={money.owed} />, href: '/app/insights' },
                ...(money.overdue > 0
                  ? [{
                      label: c.overdue,
                      value: <Money value={money.overdue} />,
                      tone: 'bad' as const,
                      href: '/app/clients',
                    }]
                  : []),
              ]}
            />

            <hr className="hairline my-4" />
            <Link href="/app/clients" className="btn-quiet px-0 text-[14px]">
              {c.allClients}
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden className="chev-onward" />
            </Link>
          </section>
        </div>
      </div>
      <Live sources={[{ table: 'leads' }, { table: 'tasks' }, { table: 'payments' }, { table: 'clients' }, { table: 'producer_tasks' }]} />
    </>
  );
}
