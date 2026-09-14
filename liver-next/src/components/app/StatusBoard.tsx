import Link from 'next/link';
import type { Locale } from '@/lib/locale';
import { ChevronLeft, ChevronDown, CalendarX2, Users, Wallet } from 'lucide-react';
import { serverCopy } from '@/lib/serverLocale';
import type { ClientStatus } from '@/lib/status';
import { ArchiveButton } from '@/components/app/ArchiveButton';
import { formatDate } from '@/lib/dates';
import { Money, Ratio, ils, Ltr } from '@/components/Ltr';
import { groupByYear } from '@/lib/eventGroups';
import { EVENT_ZONE } from '@/lib/clock';

const dateFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE, day: 'numeric', month: 'short', year: 'numeric' });


/** The number that answers "how soon".
 *
 *  Deliberately the loudest thing on the row, because it is the one fact that
 *  reorders everything else: the same empty guest list is patience at eight
 *  months and a phone call at five weeks. */
async function Countdown({ days }: { days: number | null }) {
  const c = (await serverCopy()).statusBoard;
  if (days === null) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl2 bg-surface-200 px-3 py-2 text-center">
        <CalendarX2 size={18} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
        <span className="mt-1 text-[11.5px] leading-tight text-ink-mute">{c.noDate}</span>
      </div>
    );
  }
  if (days < 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl2 bg-surface-200 px-3 py-2 text-center">
        <span className="font-display text-[15px] font-semibold leading-none text-ink-soft">{c.passed}</span>
        <span className="mt-1 text-[11.5px] leading-tight text-ink-mute">
          {Math.abs(days)} {c.daysAgo}
        </span>
      </div>
    );
  }

  /* Under a fortnight the row is this week's work, so it gets the accent.
     Everything else stays quiet, or the board is all shouting and nothing
     stands out. */
  const soon = days <= 14;
  return (
    /* The number of days is the first thing read on a row, so it is the
       thing that is large. The filled tile it sat in was carrying the
       urgency; the tone on the numeral carries it now, and the row keeps its
       hairline instead of growing a box. */
    <div className="text-center">
      <span className={`block font-display text-metric-sm font-light tabular-nums ${
        soon ? 'text-accent-bright' : 'text-ink'
      }`}>{days}</span>
      <span className="mt-0.5 block text-[11.5px] leading-tight text-ink-mute">{c.daysLeft}</span>
    </div>
  );
}

function GapChip({ label, level }: { label: string; level: 'now' | 'soon' }) {
  return (
    <span
      className={`inline-flex items-center rounded-xl2 px-2.5 py-1 text-[12.5px] font-medium ${
        level === 'now'
          ? 'bg-bad-wash text-bad'
          : 'bg-warn-wash text-warn'
      }`}
    >
      {label}
    </span>
  );
}

/* The card is the link, not the title inside it. A row that only responds to a
   three-word target is a row people miss on a phone, when every other pixel of
   it looks equally clickable. The link is an overlay covering the card, the
   content above it is inert, and the archive control is lifted back out so it
   stays its own button rather than a hole in the link. */
async function Row({ s }: { s: ClientStatus }) {
  const locale = (await serverCopy()).locale;
  const c = (await serverCopy()).statusBoard;
  return (
    <li className="card relative p-0 transition-colors focus-within:border-accent hover:border-accent">
      <Link
        href={`/app/clients/${s.id}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`${c.open} ${s.name}`}
      >
        <span className="sr-only">{s.name}</span>
      </Link>
      <div className="pointer-events-none relative flex items-stretch gap-4 p-4 sm:p-5">
        <div className="w-[74px] shrink-0">
          <Countdown days={s.daysLeft} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="inline-flex items-center gap-2 font-display text-[18.5px] font-semibold text-ink">
              {s.color && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />}
              {s.name}
            </h3>
            <p className="text-[13.5px] text-ink-mute">
              {formatDate(dateFmtFor(locale), s.eventDate, c.noDate)}
              {s.venue ? ` · ${s.venue}` : ''}
            </p>
          </div>

          {s.gaps.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {s.gaps.map((g) => (
                <li key={g.code}><GapChip label={g.label} level={g.level} /></li>
              ))}
            </ul>
          )}

          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-soft">
            {s.nextTask && (
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="text-ink-mute">{c.next}</dt>
                <dd className="truncate">{s.nextTask.title}</dd>
              </div>
            )}
            {s.guests.invited > 0 && (
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
                <dd className="tabular-nums">
                  <Ratio of={s.guests.attending} total={s.guests.invited} /> {c.attending}
                </dd>
              </div>
            )}
            {s.money.owed > 0 && (
              <div className="flex items-center gap-1.5">
                <Wallet size={14} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
                <dd className={`tabular-nums ${s.money.overdue > 0 ? 'text-bad' : ''}`}>
                  <Money value={s.money.owed} /> {c.owed}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <ChevronLeft size={18} aria-hidden strokeWidth={1.5} className="chev-onward mt-1.5 text-ink-mute" />
          <div className="pointer-events-auto relative z-10">
            <ArchiveButton clientId={s.id} archived={!!s.archivedAt} highlight={s.needsClosing} />
          </div>
        </div>
      </div>
    </li>
  );
}

export async function StatusBoard({ items }: { items: ClientStatus[] }) {
  const c = (await serverCopy()).statusBoard;
  /* Anything with a red gap floats up, then by how soon the event is, then
     the undated. Sorting on urgency rather than date alone is the difference
     between a list of events and a list of work. */
  const sorted = [...items].sort((a, b) => {
    const urgent = (s: ClientStatus) => (s.gaps.some((g) => g.level === 'now') ? 0 : 1);
    if (urgent(a) !== urgent(b)) return urgent(a) - urgent(b);
    if (a.daysLeft === null) return b.daysLeft === null ? 0 : 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  /* Years, and inside a year the two things a couple can be buying. Nothing
     is configured: the headings are whatever the events say, so opening one
     for 2028 makes that year appear the moment it is saved, and a year with
     nothing in it does not exist. The sort above still decides the order
     inside each group — urgency first, then how soon — because that is the
     same question and it should not have two answers. */
  const groups = groupByYear(sorted);

  /* One year and one kind is not a grouping, it is two headings over a list.
     The board stays flat until there is something to separate. */
  const flat = groups.length <= 1 && (groups[0]?.services.length ?? 0) <= 1;
  if (flat) {
    return (
      <ul className="list-none space-y-3.5 p-0">
        {sorted.map((s) => <Row key={s.id} s={s} />)}
      </ul>
    );
  }

  /* Each year is a drawer, and only the nearest one is open. A season that is
     eighteen months out is a thing to know exists, not a thing to scroll past
     every morning on the way to the wedding that is in five weeks — and the
     row itself says how many are inside, so closing it hides nothing. Same
     native `<details>` as the couple's screen: it works before the JavaScript
     lands and the keyboard already knows it. */
  return (
    <div className="space-y-8">
      {groups.map((g, i) => (
        <details key={g.year ?? 'none'} open={i === 0} className="group">
          <summary
            className="mb-4 flex cursor-pointer list-none items-center gap-3 py-1
                       [&::-webkit-details-marker]:hidden"
          >
            <h2 className="font-display text-[26px] font-semibold leading-none text-ink">
              {g.year ? <Ltr>{g.year}</Ltr> : c.noYear}
            </h2>
            <span className="text-[13px] text-ink-mute">
              {g.rows.length} {g.rows.length === 1 ? c.oneEvent : c.manyEvents}
            </span>
            {/* Down when closed, up when open, and the only thing on the row
                that moves. It points the same way in both directions of
                text, which is why it is this arrow and not a sideways one. */}
            <ChevronDown
              size={20} strokeWidth={1.5} aria-hidden
              className="shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
            />
          </summary>

          <div className="space-y-6">
            {g.services.map((sv) => (
              <div key={sv.service}>
                {/* The second heading only when both kinds are in this year.
                    One kind needs no label saying which one, and a subheading
                    over the whole group is a line that teaches somebody to
                    stop reading subheadings. */}
                {g.services.length > 1 && (
                  <h3 className="eyebrow mb-2.5">
                    {sv.service === 'production' ? c.serviceProduction : c.serviceManagement}
                    {' · '}{sv.rows.length}
                  </h3>
                )}
                <ul className="list-none space-y-3.5 p-0">
                  {sv.rows.map((s) => <Row key={s.id} s={s} />)}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
