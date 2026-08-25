import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarHeart, Wallet, ChevronLeft } from 'lucide-react';
import { requireAccount, isLive } from '@/lib/auth';
import { getOverview } from '@/lib/attention';
import { appCopy } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';
import { AttentionList } from '@/components/app/Attention';

export const metadata = { title: appCopy.nav.overview };

const c = appCopy.overview2;
const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');

export default async function OverviewPage() {
  const account = await requireAccount();
  if (account.role === 'client') redirect('/app/portal');
  if (!isLive(account)) redirect('/app/pending');

  const { items, next, money } = await getOverview();
  const first = account.fullName.split(' ')[0];

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
          {next && (
            <Link
              href={next.href}
              className="card group block transition-shadow duration-200 hover:shadow-lift"
            >
              <div className="flex items-center gap-2 text-bronze">
                <CalendarHeart size={16} strokeWidth={1.9} aria-hidden />
                <span className="eyebrow">{c.nextEvent}</span>
              </div>
              <p className="mt-3 font-display text-[24px] font-semibold leading-tight text-ink">
                {next.name}
              </p>
              <p className="mt-1 text-[14px] text-ink-soft">{next.date}</p>
              <p className="mt-4 font-display text-[32px] font-semibold leading-none text-ink">
                {c.inDays(next.days)}
              </p>
            </Link>
          )}

          <section className="card">
            <div className="flex items-center gap-2 text-bronze">
              <Wallet size={16} strokeWidth={1.9} aria-hidden />
              <span className="eyebrow">{c.money}</span>
            </div>

            {/* tabular-nums so the shekel figures line up down the column
                instead of shifting with every digit. */}
            <dl className="mt-4 grid gap-3 text-[15px] tabular-nums">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-soft">{c.paid}</dt>
                <dd className="font-medium text-ink">{ils(money.paid)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-soft">{c.owed}</dt>
                <dd className="font-medium text-ink">{ils(money.owed)}</dd>
              </div>
              {money.overdue > 0 && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-bad">{c.overdue}</dt>
                  <dd className="font-medium text-bad">{ils(money.overdue)}</dd>
                </div>
              )}
            </dl>

            <hr className="hairline my-4" />
            <Link href="/app/clients" className="btn-quiet px-0 text-[14px]">
              {c.allClients}
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
