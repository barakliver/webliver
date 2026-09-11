import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import type { CalItem } from '@/lib/calendar';
import type { AppUi } from '@/content/appUi';
import { ruleRange, type Verdict } from '@/lib/hebrewDate';
import { holidaysRange, type Holiday } from '@/lib/holidays';
import { fill } from '@/lib/copyText';

/**
 * One month, the way a wall calendar is turned.
 *
 * It was three months stacked from today, which answers "what does the
 * autumn look like" and nothing else: a producer holding a date for a
 * couple in the spring after next had no way to reach it, and a diary that
 * cannot show next year is not a diary. Now it is one month, any month, with
 * an arrow either side and a way back to today, and the month lives in the
 * address so a reload and a bookmark both keep it.
 *
 * Every day the month touches is drawn, including the tail of the month
 * before and the head of the month after, greyed, the way Google draws them:
 * a week is seven days whichever month they fall in, and a Sunday in the
 * grey is still a Sunday somebody can put a meeting on.
 *
 * Two calendars in every cell. The Hebrew ruling tints the background, as it
 * always has — red for no wedding, amber for depends on custom. The
 * holidays are names, never tints, so that Christmas can be on the screen
 * without the screen implying the hall is closed. Two switches, one per
 * family of days, because the couple's cousins flying in for Christmas and
 * the bar staff off for Independence Day are different facts for different
 * couples, and both live in the address with the month.
 *
 * A server component still: everything here is arithmetic over rows already
 * fetched, and the arrows are links.
 */
const SHOW = 3;

const TONE: Record<CalItem['kind'], string> = {
  event: 'bg-accent text-surface',
  task: 'bg-surface-200 text-ink',
  payment: 'bg-warn-wash text-warn',
  entry: 'bg-ok-wash text-ok',
};
const DAY_TINT: Record<Verdict, string> = {
  clear: '',
  check: 'bg-warn-wash/50',
  blocked: 'bg-bad-wash/60',
};
const HOLIDAY_TONE: Record<Holiday['tone'], string> = {
  festival: 'text-accent font-medium',
  memorial: 'text-ink-soft',
  minor: 'text-ink-mute',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The first of the month `n` months after a YYYY-MM, at noon UTC. */
function monthStart(ym: string, n: number): Date {
  const d = new Date(`${ym}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}
const ymOf = (d: Date) => iso(d).slice(0, 7);

export type GridSwitches = { jewish: boolean; christian: boolean };

/** The address of the calendar with these settings, so every link on the
 *  grid carries the month and the switches with it. */
export function calendarHref(month: string, sw: GridSwitches, day?: string): string {
  const q = new URLSearchParams();
  q.set('m', month);
  if (!sw.jewish) q.set('hj', '0');
  if (sw.christian) q.set('hc', '1');
  if (day) q.set('day', day);
  return `/app/calendar?${q.toString()}${day ? '#day' : ''}`;
}

export function MonthGrid({ items, month, today, locale, ui, open = '', switches }: {
  items: CalItem[];
  /** YYYY-MM, the month on screen. */
  month: string;
  /** Today, as an ISO date in the event zone. */
  today: string;
  locale: Locale;
  ui: AppUi;
  /** The day the drawer has open, so its cell is marked. */
  open?: string;
  switches: GridSwitches;
}) {
  const c = ui.calendar;
  const tag = locale === 'en' ? 'en-GB' : 'he-IL';
  const monthFmt = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const weekdayFmt = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: 'short' });

  /* Weekday headers, Sunday first, taken from the formatter so the English
     screen says Sun and the Hebrew one says א׳. */
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(Date.UTC(2026, 0, 4 + i))));

  const start = monthStart(month, 0);
  const year = start.getUTCFullYear();
  const mon = start.getUTCMonth();
  const lead = start.getUTCDay();
  /* Six rows always, so the grid does not change height as the months turn
     and the arrows stay under the thumb. */
  const first = new Date(Date.UTC(year, mon, 1 - lead));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setUTCDate(first.getUTCDate() + i);
    return iso(d);
  });

  const rulings = new Map(ruleRange(cells[0], 42).map((r) => [r.date, r]));
  const holidays = new Map<string, Holiday[]>();
  for (const h of holidaysRange(cells[0], 42)) {
    if (h.family === 'jewish' && !switches.jewish) continue;
    if (h.family === 'christian' && !switches.christian) continue;
    holidays.set(h.date, [...(holidays.get(h.date) ?? []), h]);
  }

  const byDay = new Map<string, CalItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);

  const prev = ymOf(monthStart(month, -1));
  const next = ymOf(monthStart(month, 1));
  const thisMonth = today.slice(0, 7);
  const anyHoliday = switches.jewish || switches.christian;

  return (
    <section className="card" aria-labelledby="grid-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="grid-title" className="font-display text-[17px] font-semibold text-ink">{c.grid}</h2>
        {/* The switches, as links that rewrite the address: no state to keep
            and nothing to hydrate, and a bookmark keeps the choice. */}
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-ink-mute">{c.holidays}:</span>
          <Link
            href={calendarHref(month, { ...switches, jewish: !switches.jewish }, open || undefined)}
            aria-pressed={switches.jewish}
            className={`rounded-full border px-3 py-1 transition ${switches.jewish ? 'border-accent bg-accent-wash text-ink' : 'border-line text-ink-soft hover:border-accent/40'}`}
          >
            {c.jewishOn}
          </Link>
          <Link
            href={calendarHref(month, { ...switches, christian: !switches.christian }, open || undefined)}
            aria-pressed={switches.christian}
            className={`rounded-full border px-3 py-1 transition ${switches.christian ? 'border-accent bg-accent-wash text-ink' : 'border-line text-ink-soft hover:border-accent/40'}`}
          >
            {c.christianOn}
          </Link>
        </div>
      </div>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.gridSub}</p>

      {/* The month and the way to the next one. The arrows point the way the
          language runs: in a right-to-left page "forward" is to the left. */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={calendarHref(prev, switches)}
            aria-label={c.prevMonth}
            title={c.prevMonth}
            className="grid size-11 place-items-center rounded-xl2 text-ink-soft transition hover:bg-surface-200 hover:text-ink"
          >
            <ChevronRight size={18} aria-hidden strokeWidth={1.5} className="chev-back" />
          </Link>
          <h3 className="min-w-[10ch] text-center font-display text-[20px] font-semibold text-ink">
            {monthFmt.format(start)}
          </h3>
          <Link
            href={calendarHref(next, switches)}
            aria-label={c.nextMonth}
            title={c.nextMonth}
            className="grid size-11 place-items-center rounded-xl2 text-ink-soft transition hover:bg-surface-200 hover:text-ink"
          >
            <ChevronLeft size={18} aria-hidden strokeWidth={1.5} className="chev-onward" />
          </Link>
        </div>
        {month !== thisMonth && (
          <Link href={calendarHref(thisMonth, switches)} className="btn-ghost min-h-[40px] px-4 text-[13.5px]">
            {c.today}
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className={`size-2.5 rounded-full ${TONE.event.split(' ')[0]}`} />{c.legendEvent}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-ink-mute" />{c.legendTask}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-warn" />{c.legendPayment}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-ok" />{c.legendEntry}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-bad" />{ui.hebrewCal.blockedLegend}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-warn/60" />{ui.hebrewCal.checkLegend}</span>
        {anyHoliday && <span className="inline-flex items-center gap-1.5 text-accent">{c.holidayLegend}</span>}
      </div>

      {/* Seven columns at every width. On a phone the titles give way to
          dots, one per item in its colour, so the whole month is in view the
          way it is on a phone's own calendar rather than four days of it and
          a scrollbar. The day is still the door, and the drawer names
          everything the dots stand for. */}
      <div className="mt-4">
        <table className="w-full table-fixed border-collapse text-[12.5px]">
          <thead>
            <tr>
              {weekdays.map((w) => (
                <th key={w} scope="col" className="border-b border-line py-1.5 text-start text-[12px] font-medium text-ink-mute">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, r) => (
              <tr key={r}>
                {cells.slice(r * 7, r * 7 + 7).map((day) => {
                  const inMonth = day.slice(0, 7) === month;
                  const rule = rulings.get(day);
                  const dayItems = byDay.get(day) ?? [];
                  const named = holidays.get(day) ?? [];
                  const isToday = day === today;
                  const reasons = (rule?.reasons ?? [])
                    .map((k) => (ui.hebrewCal.reasons as Record<string, string>)[k])
                    .filter(Boolean).join(', ');
                  return (
                    <td
                      key={day}
                      title={reasons || undefined}
                      className={`group h-[64px] border p-0.5 align-top sm:h-[96px] sm:p-1 ${day === open ? 'border-accent ring-1 ring-accent' : 'border-line'} ${rule ? DAY_TINT[rule.verdict] : ''} ${inMonth ? '' : 'bg-surface-100/60 opacity-60'}`}
                    >
                      {/* The day itself is the door: press the number and the
                          drawer above opens on that day, with the form that
                          adds to it. Today's number sits in a filled circle,
                          the one mark on the grid that is about now. */}
                      <Link
                        href={calendarHref(month, switches, day)}
                        scroll={false}
                        aria-label={`${c.day.add}: ${day}`}
                        className="mb-1 flex items-center justify-between rounded px-0.5 text-[12px] tabular-nums transition hover:bg-surface-200"
                      >
                        <span className={isToday
                          ? 'grid size-6 place-items-center rounded-full bg-accent font-semibold text-surface'
                          : 'px-0.5 text-ink-mute'}>
                          {Number(day.slice(8, 10))}
                        </span>
                        <span aria-hidden className="text-[13px] leading-none opacity-0 transition group-hover:opacity-70">+</span>
                      </Link>
                      {named.length > 0 && (
                        <p className="mb-0.5 truncate px-0.5 text-[10px] leading-snug sm:text-[11px]">
                          {named.filter((h) => h.first).map((h, i) => (
                            <span key={h.key} className={HOLIDAY_TONE[h.tone]}>
                              {i > 0 ? ' · ' : ''}{ui.holiday[h.key]}
                            </span>
                          ))}
                        </p>
                      )}
                      {dayItems.length > 0 && (
                        <p className="flex flex-wrap gap-0.5 px-0.5 sm:hidden" aria-hidden>
                          {dayItems.slice(0, 6).map((it) => (
                            <span
                              key={it.id}
                              className={`size-1.5 rounded-full ${TONE[it.kind].split(' ')[0]}`}
                              style={it.kind === 'event' && it.color ? { background: it.color } : undefined}
                            />
                          ))}
                        </p>
                      )}
                      <ul className="hidden space-y-0.5 sm:block">
                        {dayItems.slice(0, SHOW).map((it) => (
                          <li key={it.id}>
                            <Link
                              href={it.href}
                              title={`${it.title}${it.detail ? ` · ${it.detail}` : ''}`}
                              className={`block truncate rounded px-1.5 py-0.5 text-[11.5px] leading-snug ${TONE[it.kind]} ${it.done ? 'line-through opacity-60' : ''}`}
                              style={it.kind === 'event' && it.color ? { background: it.color } : undefined}
                            >
                              {it.title}
                            </Link>
                          </li>
                        ))}
                        {dayItems.length > SHOW && (
                          <li className="px-1.5 text-[11px] text-ink-mute">{fill(c.more, { n: dayItems.length - SHOW })}</li>
                        )}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
