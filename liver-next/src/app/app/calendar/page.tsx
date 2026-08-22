import Link from 'next/link';
import { CalendarHeart, CheckCircle2, Wallet, CalendarPlus } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { getCalendar, type CalItem } from '@/lib/calendar';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';

export const metadata = { title: appCopy.calendar.title };

const c = appCopy.calendar;
const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');

const monthFmt = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

const ICON = { event: CalendarHeart, task: CheckCircle2, payment: Wallet };
const TONE: Record<CalItem['kind'], string> = {
  event: 'bg-accent-wash text-accent',
  task: 'bg-surface-200 text-ink-soft',
  payment: 'bg-warn-wash text-warn',
};

export default async function CalendarPage() {
  await requireLiveProducer();
  const sb = await supabaseServer();
  const all = await getCalendar(sb);

  /* Forward-looking by default. What happened last month is on the event's own
     screen; a diary is for what is coming. */
  const today = new Date().toISOString().slice(0, 10);
  const items = all.filter((i) => i.date >= today);

  /* Grouped by month, then by day, because that is how somebody scanning for
     "when is the next free weekend" actually reads it. */
  const byMonth = new Map<string, CalItem[]>();
  for (const i of items) {
    const key = i.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), i]);
  }

  return (
    <>
      <PageHead title={c.title} sub={c.sub} />

      <div className="mb-7 flex flex-wrap gap-2">
        <a href="/app/calendar.ics" className="btn-ghost inline-flex items-center gap-2 text-[14px]">
          <CalendarPlus size={16} aria-hidden strokeWidth={1.75} />
          {c.subscribe}
        </a>
      </div>

      {items.length === 0 ? (
        <Empty text={c.empty} />
      ) : (
        <div className="space-y-9">
          {[...byMonth.entries()].map(([month, monthItems]) => {
            const byDay = new Map<string, CalItem[]>();
            for (const i of monthItems) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);

            return (
              <section key={month}>
                <h2 className="eyebrow mb-3">{monthFmt.format(new Date(month + '-01T00:00:00'))}</h2>
                <div className="space-y-4">
                  {[...byDay.entries()].map(([date, dayItems]) => (
                    <div key={date} className="card">
                      <h3 className="text-[14px] font-semibold text-ink">
                        {dayFmt.format(new Date(date + 'T00:00:00'))}
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {dayItems.map((i) => {
                          const Icon = ICON[i.kind];
                          return (
                            <li key={i.id}>
                              <Link
                                href={i.href}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:brightness-[0.98] ${TONE[i.kind]}`}
                              >
                                <Icon size={16} aria-hidden strokeWidth={1.75} className="shrink-0" />
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate text-[15px] ${i.done ? 'line-through opacity-60' : ''}`}>
                                    {i.title}
                                  </span>
                                  {i.detail && <span className="block truncate text-[13px] opacity-75">{i.detail}</span>}
                                </span>
                                {i.amount ? (
                                  <span className="shrink-0 text-[14px] tabular-nums">{ils(i.amount)}</span>
                                ) : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Live sources={[{ table: 'clients' }, { table: 'tasks' }, { table: 'payments' }]} />
    </>
  );
}
