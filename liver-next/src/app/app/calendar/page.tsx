import Link from 'next/link';
import { CalendarHeart, CheckCircle2, Wallet, CalendarPlus } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { getCalendar, type CalItem } from '@/lib/calendar';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { CalendarFeed } from '@/components/app/CalendarFeed';
import { HebrewCalendar } from '@/components/app/HebrewCalendar';
import { LabelToolbar } from '@/components/app/LabelToolbar';
import { loadLabels } from '@/lib/labels';
import { IssueReporter } from '@/components/app/IssueReporter';
import { Money, ils } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';

export const metadata = { title: appCopy.calendar.title };

const c = appCopy.calendar;

const monthFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long' });

const ICON = { event: CalendarHeart, task: CheckCircle2, payment: Wallet };
const TONE: Record<CalItem['kind'], string> = {
  event: 'bg-accent-wash text-accent',
  task: 'bg-surface-200 text-ink-soft',
  payment: 'bg-warn-wash text-warn',
};

export default async function CalendarPage() {
  const account = await requireLiveProducer();
  const sb = await supabaseServer();
  const [all, tags] = await Promise.all([getCalendar(sb), loadLabels(sb, 'event_tag')]);

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
      <PageHead
        title={c.title} sub={c.sub}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />

      {/* Which evenings are available at all, before the diary of what is
          already booked. It is the question a date gets asked first. */}
      <div className="mb-7 space-y-6">
        <HebrewCalendar from={today} />
        <LabelToolbar kind="event_tag" labels={tags} />
      </div>

      <div className="mb-7 space-y-3">
        {/* The file first, because it is the thing that works with no setup at
            all, and the subscription under it for the people who want the
            diary to stay right without being re-saved. */}
        <a href="/app/calendar.ics" className="btn-ghost inline-flex items-center gap-2 text-[14px]">
          <CalendarPlus size={16} aria-hidden strokeWidth={1.5} />
          {c.subscribe}
        </a>
        <CalendarFeed />
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
                                className={`flex items-center gap-3 rounded-xl2 px-3 py-2.5 transition hover:brightness-[0.98] ${TONE[i.kind]}`}
                              >
                                {/* The producer's own colour, when they gave
                                    this event one. A hairline rather than a
                                    fill: the row already carries a tone for
                                    what kind of thing it is. */}
                                {i.color
                                  ? <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
                                  : <Icon size={16} aria-hidden strokeWidth={1.5} className="shrink-0" />}
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate text-[15px] ${i.done ? 'line-through opacity-60' : ''}`}>
                                    {i.title}
                                  </span>
                                  {i.detail && <span className="block truncate text-[13px] opacity-75">{i.detail}</span>}
                                </span>
                                {i.amount ? (
                                  <span className="shrink-0 text-[14px] tabular-nums"><Money value={i.amount} /></span>
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
