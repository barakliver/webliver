import Link from 'next/link';
import type { Locale } from '@/lib/locale';
import { CalendarHeart, CheckCircle2, Wallet, CalendarPlus, NotebookPen } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { getCalendar, type CalItem } from '@/lib/calendar';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead, Empty } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { CalendarFeed } from '@/components/app/CalendarFeed';
import { HebrewCalendar } from '@/components/app/HebrewCalendar';
import { MonthGrid } from '@/components/app/MonthGrid';
import { LabelToolbar } from '@/components/app/LabelToolbar';
import { DayDrawer, type DiaryEntryRow } from '@/components/app/DayDrawer';
import { GoogleSyncCard, type GoogleStatus } from '@/components/app/GoogleSyncCard';
import { loadLabels } from '@/lib/labels';
import { IssueReporter } from '@/components/app/IssueReporter';
import { Money } from '@/components/Ltr';
import { EVENT_ZONE, todayInZone } from '@/lib/clock';
import { safeRows, safeValue } from '@/lib/safe';
import { googleConfigured } from '@/lib/google/oauth';

export async function generateMetadata() {
  return { title: (await serverCopy()).calendar.title };
}

export const dynamic = 'force-dynamic';

const monthFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE, month: 'long', year: 'numeric' });
const dayFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
const fullDayFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const ICON = { event: CalendarHeart, task: CheckCircle2, payment: Wallet, entry: NotebookPen };
const TONE: Record<CalItem['kind'], string> = {
  event: 'bg-accent-wash text-accent',
  task: 'bg-surface-200 text-ink-soft',
  payment: 'bg-warn-wash text-warn',
  entry: 'bg-ok-wash text-ok',
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The diary.
 *
 * The month as a table, a day opened from it with the form that adds to
 * it, the Google link under that, and then the list. The open day and the
 * word Google sends back both live in the address, so a reload keeps the
 * day and a bookmark of the calendar itself has neither.
 */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ day?: string; google?: string }> }) {
  const ui = await serverCopy();
  const locale = ui.locale;
  const c = ui.calendar;
  const account = await requireLiveProducer();
  const sb = await supabaseServer();
  const params = await searchParams;
  const openDay = DAY.test(params.day ?? '') ? String(params.day) : '';
  const notice = String(params.google ?? '').replace(/[^a-z]/g, '');

  const [all, tags, clients, google] = await Promise.all([
    getCalendar(sb),
    loadLabels(sb, 'event_tag'),
    safeRows<{ id: string; display_name: string }>('calendar events', sb.from('clients')
      .select('id,display_name').is('archived_at', null).order('event_date', { ascending: true, nullsFirst: false })),
    safeValue<GoogleStatus | null>('google link', (async () => {
      const { data } = await sb.from('my_google_calendar').select('email,ready,connected_at,last_sync_at,last_error').maybeSingle();
      return (data as GoogleStatus | null) ?? null;
    })(), null),
  ]);

  /* The rows behind the open day's entries, for the drawer that edits them. */
  const dayEntries = openDay
    ? await safeRows<DiaryEntryRow>('day entries', sb.from('diary_entries')
        .select('id,client_id,title,on_date,at_time,duration_min,note').eq('on_date', openDay).order('at_time', { ascending: true, nullsFirst: true }))
    : [];

  /* Forward-looking by default. What happened last month is on the event's own
     screen; a diary is for what is coming. */
  const today = todayInZone();
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

      {/* The open day first, where the eye lands after pressing a cell.
          Then the month as a table: every couple's deadline in its cell,
          the day tinted by the Hebrew calendar. Then which evenings are
          available at all, with the reasons, and then the list. */}
      <div className="mb-7 space-y-6">
        {openDay && (
          <div id="day">
            <DayDrawer
              day={openDay}
              dayText={fullDayFmtFor(locale).format(new Date(`${openDay}T12:00:00Z`))}
              items={all.filter((i) => i.date === openDay)}
              entries={dayEntries}
              clients={clients.map((k) => ({ id: k.id, name: k.display_name }))}
            />
          </div>
        )}
        <MonthGrid items={all} from={today} months={3} locale={locale} ui={ui} open={openDay} />
        <HebrewCalendar from={today} />
        <LabelToolbar kind="event_tag" labels={tags} />
      </div>

      <div className="mb-7 space-y-3">
        <GoogleSyncCard ui={ui} status={google} configured={googleConfigured()} notice={notice} />
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
                <h2 className="eyebrow mb-3">{monthFmtFor(locale).format(new Date(month + '-01T00:00:00'))}</h2>
                <div className="space-y-4">
                  {[...byDay.entries()].map(([date, dayItems]) => (
                    <div key={date} className="card">
                      <h3 className="text-[14px] font-semibold text-ink">
                        <Link href={`/app/calendar?day=${date}#day`} className="hover:underline">
                          {dayFmtFor(locale).format(new Date(date + 'T00:00:00'))}
                        </Link>
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

      <Live sources={[{ table: 'clients' }, { table: 'tasks' }, { table: 'payments' }, { table: 'diary_entries' }]} />
    </>
  );
}
