import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarHeart, Wallet, ChevronLeft } from 'lucide-react';
import { requireAccount, isLive } from '@/lib/auth';
import { getOverview } from '@/lib/attention';
import { Live } from '@/components/app/Live';
import { appCopy } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';
import { AttentionList } from '@/components/app/Attention';
import { Money, ils } from '@/components/Ltr';
import { MetricRows } from '@/components/app/Metric';
import { Anniversaries } from '@/components/app/Anniversaries';
import { supabaseServer } from '@/lib/supabase/server';
import { loadAnniversaries } from '@/lib/workflow';

export const metadata = { title: appCopy.nav.overview };

const c = appCopy.overview2;

export default async function OverviewPage() {
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

  return (
    <>
      <PageHead
        title={`${appCopy.overview.greeting}${first ? ' ' + first : ''}`}
        sub={
          items.length
            ? `${items.length} ${items.length === 1 ? 'דבר מחכה' : 'דברים מחכים'} להחלטה שלך`
            : c.clearSub
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-8">
        {/* The pile, first and biggest, because it is the reason to open the
            screen at all. */}
        <section aria-labelledby="needs-you" className="min-w-0">
          <h2 id="needs-you" className="eyebrow mb-3">{c.needsYou}</h2>
          <AttentionList items={items} />
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
              <p className="mt-3 font-display text-[24px] font-light leading-tight text-ink">
                {next.name}
              </p>
              <p className="mt-1 text-[14px] text-ink-soft">{next.date}</p>
              <p className="mt-4 font-display text-[32px] font-light leading-none text-ink">
                {c.inDays(next.days)}
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
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
            </Link>
          </section>
        </div>
      </div>
      <Live sources={[{ table: 'leads' }, { table: 'tasks' }, { table: 'payments' }, { table: 'clients' }]} />
    </>
  );
}
