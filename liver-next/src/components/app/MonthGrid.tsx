import Link from 'next/link';
import type { Locale } from '@/lib/locale';
import type { CalItem } from '@/lib/calendar';
import type { AppUi } from '@/content/appUi';
import { ruleRange, type Verdict } from '@/lib/hebrewDate';
import { fill } from '@/lib/copyText';

/**
 * The diary as a table.
 *
 * The list under it answers "what is next"; this answers "what does October
 * look like", which is the question a producer asks with a couple on the
 * phone wanting a date. Seven columns, Sunday first as the week runs here,
 * every couple's deadline in its cell, and the day itself tinted by the
 * Hebrew calendar so a Saturday night in the Omer reads as closed before
 * anyone counts.
 *
 * A server component: nothing here needs a hook, and the list beside it is
 * one too. Three cells' worth of items per day and then a count, because a
 * wedding week with nine payments due is a cell nobody can read.
 */
const SHOW = 3;

const TONE: Record<CalItem['kind'], string> = {
  event: 'bg-accent text-surface',
  task: 'bg-surface-200 text-ink',
  payment: 'bg-warn-wash text-warn',
};
const DAY_TINT: Record<Verdict, string> = {
  clear: '',
  check: 'bg-warn-wash/50',
  blocked: 'bg-bad-wash/60',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The first of the month `n` months after the given date, at noon UTC. */
function monthStart(from: string, n: number): Date {
  const d = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

export function MonthGrid({ items, from, months = 3, locale, ui }: {
  items: CalItem[];
  /** Today, as an ISO date in the event zone. */
  from: string;
  months?: number;
  locale: Locale;
  ui: AppUi;
}) {
  const c = ui.calendar;
  const tag = locale === 'en' ? 'en-GB' : 'he-IL';
  const monthFmt = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const weekdayFmt = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: 'short' });

  /* Weekday headers, Sunday first, taken from the formatter so the English
     screen says Sun and the Hebrew one says א׳. */
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(Date.UTC(2026, 0, 4 + i))));

  const last = monthStart(from, months);
  const span = Math.round((last.getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  const rulings = new Map(ruleRange(from, Math.max(1, span)).map((r) => [r.date, r]));

  const byDay = new Map<string, CalItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);

  return (
    <section className="card">
      <h2 className="font-display text-[17px] font-semibold text-ink">{c.grid}</h2>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.gridSub}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className={`size-2.5 rounded-full ${TONE.event.split(' ')[0]}`} />{c.legendEvent}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-ink-mute" />{c.legendTask}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-warn" />{c.legendPayment}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-bad" />{ui.hebrewCal.blockedLegend}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-warn/60" />{ui.hebrewCal.checkLegend}</span>
      </div>

      <div className="mt-5 space-y-8">
        {Array.from({ length: months }, (_, m) => {
          const start = monthStart(from, m);
          const year = start.getUTCFullYear();
          const month = start.getUTCMonth();
          const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
          const lead = start.getUTCDay();
          const cells: (string | null)[] = [
            ...Array.from({ length: lead }, () => null),
            ...Array.from({ length: daysIn }, (_, d) => iso(new Date(Date.UTC(year, month, d + 1)))),
          ];
          while (cells.length % 7) cells.push(null);

          return (
            <div key={`${year}-${month}`}>
              <h3 className="eyebrow mb-2">{monthFmt.format(start)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      {weekdays.map((w) => (
                        <th key={w} scope="col" className="border-b border-line py-1.5 text-start text-[12px] font-medium text-ink-mute">{w}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: cells.length / 7 }, (_, r) => (
                      <tr key={r}>
                        {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
                          if (!day) return <td key={i} className="border border-line bg-surface-100/40" />;
                          const rule = rulings.get(day);
                          const dayItems = byDay.get(day) ?? [];
                          const past = day < from;
                          const reasons = (rule?.reasons ?? [])
                            .map((k) => (ui.hebrewCal.reasons as Record<string, string>)[k])
                            .filter(Boolean).join(', ');
                          return (
                            <td
                              key={day}
                              title={reasons || undefined}
                              className={`h-[88px] border border-line p-1 align-top ${rule ? DAY_TINT[rule.verdict] : ''} ${past ? 'opacity-50' : ''}`}
                            >
                              <p className={`mb-1 text-[12px] tabular-nums ${day === from ? 'font-semibold text-accent' : 'text-ink-mute'}`}>
                                {Number(day.slice(8, 10))}
                              </p>
                              <ul className="space-y-0.5">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
