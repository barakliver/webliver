'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, CircleAlert, Info, ShieldAlert } from 'lucide-react';
import { ruleRange, hebrewLabel, type DayRuling, type Verdict } from '@/lib/hebrewDate';
import { hebrewCalCopy as c } from '@/content/site';
import { cn } from '@/lib/utils';
import { EVENT_ZONE } from '@/lib/clock';

/**
 * Which evenings a wedding can stand on.
 *
 * The first question asked of any date a couple proposes, and the one a
 * Gregorian diary cannot answer: half the year carries a restriction that is
 * invisible unless you already know the Hebrew date. A producer who offers a
 * night in the Three Weeks finds out from the couple's rabbi, after the hall
 * has been held.
 *
 * Three states rather than two. `blocked` is where mainstream practice holds
 * no wedding at all; `check` is where a real and widely-kept custom disagrees
 * — the days between Lag BaOmer and the end of the Omer, the eve of a
 * festival — and a producer should ask rather than assume. Everything else is
 * simply open, including Saturday night, which is the busiest wedding slot in
 * the country and which a naive "no Shabbat" rule would grey out.
 *
 * The disclaimer is not fine print. This screen is a planning aid written by
 * software; the ruling belongs to the couple's rabbi, and saying so plainly
 * is the difference between a useful tool and one that oversteps.
 */
export function HebrewCalendar({ from }: { from: string }) {
  const [span, setSpan] = useState<30 | 60>(30);
  const days = useMemo(() => ruleRange(from, span), [from, span]);

  const counts = useMemo(() => ({
    clear: days.filter((d) => d.verdict === 'clear').length,
    check: days.filter((d) => d.verdict === 'check').length,
    blocked: days.filter((d) => d.verdict === 'blocked').length,
  }), [days]);

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <CalendarCheck size={17} strokeWidth={1.5} aria-hidden />
            {c.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>

        <nav className="inline-flex rounded-xl2 border border-line bg-surface-100 p-1 text-[13.5px]" aria-label={c.title}>
          {([30, 60] as const).map((n) => (
            <button
              key={n} type="button" onClick={() => setSpan(n)} aria-pressed={span === n}
              className={cn(
                'min-h-[36px] rounded-xl2 px-3.5 transition',
                span === n ? 'bg-card font-medium text-ink' : 'text-ink-mute hover:text-ink',
              )}
            >
              {n === 30 ? c.next30 : c.next60}
            </button>
          ))}
        </nav>
      </div>

      {/* The legend, with the count beside each state: "eleven open evenings
          in the next thirty" is the answer to the question that brought
          somebody here. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Legend tone="clear" label={c.clearLegend} n={counts.clear} />
        <Legend tone="check" label={c.checkLegend} n={counts.check} />
        <Legend tone="blocked" label={c.blockedLegend} n={counts.blocked} />
      </div>

      <ul className="mt-5 divide-y divide-line border-t border-line">
        {days.map((d, i) => <Row key={d.date} day={d} today={i === 0} />)}
      </ul>

      <div className="mt-5 rounded-xl2 border border-line bg-surface-100 px-4 py-3">
        <p className="inline-flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
          <Info size={14} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
          <span>{c.disclaimer}</span>
        </p>
        <p className="mt-2 ps-6 text-[12.5px] leading-relaxed text-ink-mute">{c.custom}</p>
      </div>
    </section>
  );
}

const TONE: Record<Verdict, { chip: string; dot: string; row: string }> = {
  clear:   { chip: 'bg-ok-wash text-ok',     dot: 'bg-ok',     row: '' },
  check:   { chip: 'bg-warn-wash text-warn', dot: 'bg-warn',   row: '' },
  blocked: { chip: 'bg-bad-wash text-bad',   dot: 'bg-bad',    row: 'bg-bad-wash/40' },
};

function Legend({ tone, label, n }: { tone: Verdict; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl2 border border-line px-3 py-1.5 text-[12.5px] text-ink-soft">
      <span aria-hidden className={cn('size-2.5 rounded-full', TONE[tone].dot)} />
      {label}
      <span className="tabular-nums text-ink-mute">{n}</span>
    </span>
  );
}

const dayFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, weekday: 'short', day: 'numeric', month: 'short' });

function Row({ day, today }: { day: DayRuling; today: boolean }) {
  const tone = TONE[day.verdict];
  const words = day.reasons.map((r) => c.reasons[r]).filter(Boolean);

  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5', tone.row)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', tone.dot)} />

      <span className="w-[104px] shrink-0 text-[13.5px] text-ink">
        {dayFmt.format(new Date(`${day.date}T12:00:00Z`))}
      </span>

      {/* The Hebrew date the evening begins, which is the one the restriction
          is actually about. */}
      <span className="w-[112px] shrink-0 text-[12.5px] text-ink-mute">
        {hebrewLabel(nextDay(day.date))}
      </span>

      <span className="min-w-0 flex-1 text-[13px] text-ink-soft">
        {words.length > 0 ? words.join(' · ') : ''}
      </span>

      {today && <span className="rounded-xl2 bg-surface-200 px-2 py-0.5 text-[11.5px] text-ink-mute">{c.today}</span>}

      {day.verdict !== 'clear' && (
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-xl2 px-2.5 py-1 text-[12px] font-medium', tone.chip)}>
          {day.verdict === 'blocked'
            ? <ShieldAlert size={12} strokeWidth={1.5} aria-hidden />
            : <CircleAlert size={12} strokeWidth={1.5} aria-hidden />}
          {day.verdict === 'blocked' ? c.blocked : c.check}
        </span>
      )}
    </li>
  );
}

/** The Gregorian day whose Hebrew date the evening belongs to. */
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
