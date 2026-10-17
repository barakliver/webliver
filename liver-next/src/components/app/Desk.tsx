import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { fill } from '@/lib/copyText';
import { groupByYear } from '@/lib/eventGroups';
import { EVENT_ZONE } from '@/lib/clock';
import { Money } from '@/components/Ltr';
import { cn } from '@/lib/utils';
import type { SeasonEvent } from '@/lib/attention';
import type { Stats } from '@/lib/pipeline';

/**
 * The producer's desk, from the plum design he chose: three columns on a
 * wide screen, his morning on the right, the season in the middle, the
 * leads and the money on the left, and on a phone the same three stacked in
 * that order.
 *
 * These take their wording as props rather than reading it, because the
 * page that draws them is a server component and already holds the copy;
 * a client boundary here would buy nothing but bytes.
 */

export type SeasonCopy = {
  season: string; seasonN: string; seasonOne: string; noDate: string;
  daysN: string; today: string; tomorrow: string;
  production: string; management: string; allClients: string;
};

/** How many events the column draws before it hands over to the list. A
 *  season with forty open files is a list screen's job, and the column is
 *  for seeing what is coming. */
const SHOWN = 8;

export function SeasonColumn({ events, copy, dateLocale }: {
  events: SeasonEvent[];
  copy: SeasonCopy;
  dateLocale: string;
}) {
  const shown = events.slice(0, SHOWN);
  const groups = groupByYear(shown.map((e) => ({ ...e, eventDate: e.date, service: e.service ?? undefined })));
  /* The next one ahead gets the filled circle: the one event on the
     screen that is the answer to "what is coming". */
  const next = events.find((e) => e.days !== null && e.days >= 0)?.id ?? null;
  const day = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', timeZone: EVENT_ZONE });
  const month = new Intl.DateTimeFormat(dateLocale, { month: 'short', timeZone: EVENT_ZONE });
  const counted = (n: number) => (n === 1 ? copy.seasonOne : fill(copy.seasonN, { n }));
  const away = (d: number | null) =>
    d === null ? copy.noDate : d === 0 ? copy.today : d === 1 ? copy.tomorrow : fill(copy.daysN, { n: d });

  return (
    <section className="card animate-rise" style={{ animationDelay: '.15s' }} aria-labelledby="desk-season">
      <h2 id="desk-season" className="eyebrow">{copy.season}</h2>
      {groups.map((g) => (
        <div key={g.year ?? 'none'} className="mt-4 first-of-type:mt-3">
          <div className="flex items-baseline justify-between border-b border-line-strong pb-2">
            <span className="font-display text-panel font-light text-ink tabular-nums">{g.year ?? copy.noDate}</span>
            <span className="text-meta text-ink-mute">{counted(g.rows.length)}</span>
          </div>
          <ul className="list-none p-0">
            {g.rows.map((e) => {
              const at = e.date ? new Date(e.date + 'T12:00:00') : null;
              const lead = e.id === next;
              const meta = [
                e.venue,
                e.guests ? String(e.guests) : null,
                e.service === 'management' ? copy.management : copy.production,
              ].filter(Boolean).join(' · ');
              return (
                <li key={e.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/app/clients/${e.id}`}
                    className="group flex min-h-[56px] items-center gap-3 py-3 transition-colors duration-touch"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-full text-center text-micro leading-tight',
                        lead ? 'bg-accent text-surface' : 'border border-line-strong text-ink',
                      )}
                    >
                      {at ? <span>{day.format(at)}<br />{month.format(at)}</span> : '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lead text-ink group-hover:text-accent">{e.name}</span>
                      <span className="block truncate text-meta text-ink-mute">{meta}</span>
                    </span>
                    <span className={cn('shrink-0 text-meta tabular-nums', lead ? 'text-accent' : 'text-ink-mute')}>
                      {away(e.days)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Link href="/app/clients" className="btn-quiet mt-3 px-0 text-body">
        {copy.allClients}
        {events.length > SHOWN && <span className="text-ink-mute tabular-nums"> ({events.length})</span>}
        <ChevronLeft size={16} strokeWidth={1.5} aria-hidden className="chev-onward" />
      </Link>
    </section>
  );
}

export type LeadCopy = { leads: string; leadsWeek: string; leadsMeeting: string; leadsHours: string; unknown: string; allLeads: string };

export function LeadFigures({ stats, copy }: { stats: Stats; copy: LeadCopy }) {
  const rows: { label: string; value: string }[] = [
    { label: copy.leadsWeek, value: String(stats.newThisWeek) },
    { label: copy.leadsMeeting, value: stats.toMeeting === null ? copy.unknown : `${stats.toMeeting}%` },
    { label: copy.leadsHours, value: stats.responseHours === null ? copy.unknown : String(stats.responseHours) },
  ];
  return (
    /* A swatch of the card's Boho rather than a white card like its
       neighbours: three columns in one white are three columns of the same
       thing, and the leads are the one that is about people waiting. */
    <section className="animate-rise rounded-card bg-tone-boho p-5 text-tone-boho-on sm:p-6" style={{ animationDelay: '.3s' }} aria-labelledby="desk-leads">
      <h2 id="desk-leads" className="eyebrow text-tone-boho-on/90">{copy.leads}</h2>
      <dl className="mt-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-tone-boho-on/25 py-2.5 last:border-b-0">
            <dt className="text-body text-tone-boho-on/90">{r.label}</dt>
            <dd className="font-display text-figure font-light tabular-nums text-tone-boho-on"><bdi>{r.value}</bdi></dd>
          </div>
        ))}
      </dl>
      <Link href="/app/leads" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-body text-tone-boho-on underline-offset-4 hover:underline">
        {copy.allLeads}
        <ChevronLeft size={16} strokeWidth={1.5} aria-hidden className="chev-onward" />
      </Link>
    </section>
  );
}

export type MoneyCopy = { money: string; paid: string; owed: string; overdue: string };

/**
 * The money as bars. Each row is still a way in, to the same places the
 * rows went before: collected and open to the numbers screen, late to the
 * events carrying it. The bars share one scale, everything billed, so the
 * lengths can be compared with each other and not only read.
 */
export function MoneyBars({ money, copy }: {
  money: { paid: number; owed: number; overdue: number };
  copy: MoneyCopy;
}) {
  const total = Math.max(1, money.paid + money.owed);
  const rows = [
    { key: 'paid', label: copy.paid, value: money.paid, href: '/app/insights', bar: 'bg-accent' },
    { key: 'owed', label: copy.owed, value: money.owed, href: '/app/insights', bar: 'bg-ink-mid' },
    ...(money.overdue > 0
      ? [{ key: 'overdue', label: copy.overdue, value: money.overdue, href: '/app/clients', bar: 'bg-bad' }]
      : []),
  ];
  return (
    <section className="card animate-rise" style={{ animationDelay: '.45s' }} aria-labelledby="desk-money">
      <h2 id="desk-money" className="eyebrow">{copy.money}</h2>
      <ul className="mt-3 list-none space-y-3 p-0">
        {rows.map((r, k) => (
          <li key={r.key}>
            <Link href={r.href} className="group block min-h-[44px] py-1">
              <span className="flex items-baseline justify-between gap-3 text-body">
                <span className={cn('text-ink-soft group-hover:text-accent', r.key === 'overdue' && 'text-bad')}>{r.label}</span>
                <span className={cn('tabular-nums', r.key === 'overdue' ? 'text-bad' : 'text-ink')}><Money value={r.value} /></span>
              </span>
              <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-200">
                <span
                  className={cn('grow-x block h-full rounded-full', r.bar)}
                  style={{ width: `${Math.round((100 * r.value) / total)}%`, animationDelay: `${0.6 + k * 0.12}s` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
