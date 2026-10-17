import { count as plural, fill } from '@/lib/copyText';
import Link from 'next/link';
import { serverCopy } from '@/lib/serverLocale';
import type { Conversion } from '@/lib/analytics';
import type { Funnel, SourceRow, Response, Cash, CashMonth } from '@/lib/analytics';
import { Money, Ratio, ils } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';


/** A rate, or the reason there isn't one. Never a percentage sign with three
 *  cases behind it. */
async function Rate({ value }: { value: number | null }) {
  const c = (await serverCopy()).insights;
  if (value === null) {
    return <span className="text-meta font-medium text-ink-mute">{c.thin}</span>;
  }
  return (
    <span className="text-meta font-medium tabular-nums text-accent">
      {value}% <span className="font-normal text-ink-mute">{c.ofPrev}</span>
    </span>
  );
}

/**
 * The funnel as bars, measured against the top rather than against each other.
 *
 * Each step's width is its share of all enquiries, so the narrowing is the
 * information. A chart where every bar is scaled to its own step is a chart
 * where nothing ever looks like it is being lost.
 */
export async function FunnelChart({ funnel }: { funnel: Funnel }) {
  const c = (await serverCopy()).insights;
  const LABELS: Record<string, string> = {
    leads: c.funnel.leads, contacted: c.funnel.contacted, meeting: c.funnel.meeting, won: c.funnel.won,
  };
  const top = Math.max(funnel.total, 1);
  return (
    <section className="card">
      <h2 className="head-panel">{c.funnel.title}</h2>
      <p className="mt-1 text-body text-ink-soft">{c.funnel.sub}</p>

      <ul className="mt-5 list-none space-y-3 p-0">
        {funnel.steps.map((s, i) => (
          <li key={s.key}>
            {/* The whole step is the way into the enquiries it counts. It goes
                to the list unfiltered, on purpose: these counts are cumulative
                and a logged call counts as contact whether or not anybody
                moved the status afterwards, so a filter by status would land
                on a shorter list than the number that was tapped. A link that
                disagrees with the figure above it is worse than no link. */}
            <Link
              href="/app/leads"
              className="group/metric flex items-baseline justify-between gap-3 rounded-xl2
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-accent"
            >
              <span className="text-body font-medium text-ink transition-colors
                               group-hover/metric:text-accent">
                {LABELS[s.key] ?? s.key}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-head font-medium tabular-nums text-ink transition-colors
                                 group-hover/metric:text-accent">
                  {s.count}
                </span>
                {i > 0 && <Rate value={s.rate} />}
              </span>
            </Link>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-200">
              <div
                className="grow-x h-full rounded-full bg-accent"
                style={{ width: `${Math.round((s.count / top) * 100)}%`, animationDelay: `${0.2 + i * 0.1}s` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-meta text-ink-mute">{c.thinHint}</p>
    </section>
  );
}

export async function Sources({ rows }: { rows: SourceRow[] }) {
  const c = (await serverCopy()).insights;
  if (rows.length === 0) return null;
  const topLeads = Math.max(...rows.map((r) => r.leads), 1);
  return (
    <section className="card">
      <h2 className="head-panel">{c.sources.title}</h2>
      <p className="mt-1 text-body text-ink-soft">{c.sources.sub}</p>

      {/* A bar per channel, measured against the busiest, with the closing
          rate beside it in words. A channel with one enquiry that closed is
          one enquiry, not a hundred percent, and a bar the width of its
          enquiries says so before the number does. */}
      <ul className="mt-5 list-none space-y-4 p-0">
        {rows.map((r, i) => (
          <li key={r.source}>
            <div className="flex items-baseline justify-between gap-3 text-body">
              <span className="text-ink">{r.source === 'unknown' ? c.sources.unknown : r.source}</span>
              <span className="tabular-nums text-ink-soft">
                {r.rate === null
                  ? <Ratio of={r.won} total={r.leads} className="text-meta text-ink-mute" />
                  : <><Ratio of={r.won} total={r.leads} /> · <span className="font-medium text-accent">{r.rate}%</span></>}
              </span>
            </div>
            <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-200">
              <div className="grow-x h-full rounded-full bg-accent" style={{ width: `${Math.round((r.leads / topLeads) * 100)}%`, animationDelay: `${0.2 + i * 0.08}s` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One figure, big, with the thing it is a figure about under it.
 *
 *  `href` where there is somewhere real to go, and left off where there is
 *  not. Money already collected has no screen behind it and gets no arrow;
 *  money that is late is a list of events, and enquiries still waiting are a
 *  list of people. Sending all of them to the same page so that everything
 *  looks clickable teaches the opposite of what it is meant to. */
function Figure({ label, value, tone = 'ink', note, href }: {
  /* ReactNode rather than string: an amount arrives as <Money>, which is an
     element, because a bare shekel string inside a Hebrew page renders with
     the sign on the wrong side. */
  label: string; value: React.ReactNode; tone?: 'ink' | 'ok' | 'warn' | 'bad';
  note?: string; href?: string;
}) {
  /* No box. On this palette a figure is a figure and a hairline separates
     it from the next one; the filled tile it used to sit in belonged to the
     version with cards. The tone stays on the numeral, where it is measured
     against the ivory rather than against a wash. */
  return <Metric kicker={label} value={value} sub={note} tone={tone} href={href} />;
}

export async function CashPanel({ cash, months }: { cash: Cash; months: CashMonth[] }) {
  const ui = await serverCopy();
  const c = ui.insights;
  const monthFmt = new Intl.DateTimeFormat(ui.locale === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', month: 'short' });
  const peak = Math.max(...months.map((m) => m.amount), 0);
  const peakAt = peak > 0 ? months.findIndex((m) => m.amount === peak) : -1;
  return (
    <section className="card">
      <h2 className="head-panel">{c.cash.title}</h2>
      <p className="mt-1 text-body text-ink-soft">{c.cash.sub}</p>
      {/* Three across only where three six-figure amounts in the display face
          actually fit. At tablet widths the columns fall to ~180px each and
          the numerals collide, which on a money panel reads as one wrong
          number rather than as three cramped ones. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Figure label={c.cash.collected} value=<Money value={cash.collected} /> tone="ok" />
        <Figure label={c.cash.due} value=<Money value={cash.due} /> href="/app/clients" />
        <Figure
          label={c.cash.overdue}
          value=<Money value={cash.overdue} />
          tone={cash.overdue > 0 ? 'bad' : 'ink'}
          note={cash.overdueCount > 0 ? plural(c.cash.overdueCount, cash.overdueCount) : undefined}
          href={cash.overdue > 0 ? '/app/clients' : undefined}
        />
      </div>

      {/* The months ahead. Heights are against the busiest month, so a quiet
          September is visibly quiet; the one that is most is the rose. Late
          money is counted in this month (see `cashByMonth`). The bars are
          drawn for the eye and the list under them says the same in words. */}
      <p className="mt-6 text-meta text-ink-mute">{c.cash.chart}</p>
      <div aria-hidden className="mt-3 flex h-40 items-end gap-3">
        {months.map((m, i) => (
          <div key={m.ym} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={`grow-y w-full rounded-t-[10px] rounded-b-[4px] ${i === peakAt ? 'bg-accent' : 'bg-ink-mute/40'}`}
              style={{ height: m.amount > 0 ? `${Math.max(4, Math.round((m.amount / peak) * 100))}%` : '2px', animationDelay: `${0.15 + i * 0.07}s` }}
            />
            <span className="text-micro text-ink-mute">{monthFmt.format(new Date(`${m.ym}-01T12:00:00Z`))}</span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {months.map((m) => (
          <li key={m.ym}>{monthFmt.format(new Date(`${m.ym}-01T12:00:00Z`))}: <Money value={m.amount} /></li>
        ))}
      </ul>
    </section>
  );
}

export async function ResponsePanel({ r }: { r: Response }) {
  const c = (await serverCopy()).insights;
  return (
    <section className="card">
      <h2 className="head-panel">{c.response.title}</h2>
      <p className="mt-1 text-body text-ink-soft">{c.response.sub}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Figure
          label={c.response.median}
          value={r.medianHours === null ? '·'
            : r.medianHours < 1 ? c.response.hours.lessThanOne
            : r.medianHours < 2 ? c.response.hours.one
            : fill(c.response.hours.many, { n: r.medianHours })}
          note={r.medianHours === null ? c.response.none : undefined}
        />
        <Figure label={c.response.answered} value={String(r.answered)} href="/app/leads" />
        <Figure
          label={c.response.waiting}
          value={String(r.waiting)}
          tone={r.waiting > 0 ? 'bad' : 'ok'}
          href={r.waiting > 0 ? '/app/leads' : undefined}
        />
      </div>
    </section>
  );
}

export async function Health({ signed, overdue, waiting, overdueMoney }: {
  signed: { signed: number; of: number }; overdue: number; waiting: number; overdueMoney: number;
}) {
  const c = (await serverCopy()).insights;
  const clear = overdue === 0 && waiting === 0 && overdueMoney === 0;
  return (
    <section aria-labelledby="health-title">
      <h2 id="health-title" className="sr-only">{c.health.title}</h2>
      {/* Four tiles, one thing each, in the order a morning asks them: what
          is signed, what is late in work, what is late in money, who is
          waiting. Nothing here is amber: late is the wine and nothing is
          the ink. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><Figure
          label={c.health.signed}
          value={<Ratio of={signed.signed} total={signed.of} />}
          href="/app/clients"
        /></div>
        <div className="card"><Figure
          label={c.health.overdueTasks}
          value={String(overdue)}
          tone={overdue > 0 ? 'bad' : 'ok'}
          href={overdue > 0 ? '/app/clients' : undefined}
        /></div>
        <div className="card"><Figure
          label={c.cash.overdue}
          value=<Money value={overdueMoney} />
          tone={overdueMoney > 0 ? 'bad' : 'ok'}
          href={overdueMoney > 0 ? '/app/clients' : undefined}
        /></div>
        <div className="card"><Figure
          label={c.health.waiting}
          value={String(waiting)}
          tone={waiting > 0 ? 'bad' : 'ok'}
          href={waiting > 0 ? '/app/leads' : undefined}
        /></div>
      </div>

      {clear ? (
        <p className="mt-4 text-body text-ink-soft">{c.health.clear}</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Links rather than status chips. A chip reports a state; these
              take you somewhere, and dressing one as the other is how a person
              learns not to tap either. */}
          {waiting > 0 && <Link href="/app/leads" className="btn-ghost">{c.health.toLeads}</Link>}
          {(overdue > 0 || overdueMoney > 0) && <Link href="/app/clients" className="btn-ghost">{c.health.toClients}</Link>}
        </div>
      )}
    </section>
  );
}

/**
 * What became of the enquiries.
 *
 * Sits beside the funnel and answers a different question. The funnel reads
 * the status column, so a lead counts as won because somebody chose "won" in
 * a dropdown; this counts the ones an event was actually built from, which is
 * only answerable now that an event carries a reference back to its enquiry.
 * The gap between the two numbers is the interesting one.
 */
export async function ConversionPanel({ r }: { r: Conversion }) {
  const c = (await serverCopy()).insights;
  const cc = c.conversion;
  if (r.rate === null) {
    return (
      <section className="card">
        <h2 className="head-panel">{cc.title}</h2>
        <p className="mt-3 text-body text-ink-soft">{cc.none}</p>
      </section>
    );
  }
  return (
    <section className="card">
      <h2 className="head-panel">{cc.title}</h2>
      <p className="mt-1 text-body text-ink-mute">{cc.sub}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Figure
          label={cc.rate}
          value={<Ratio of={r.converted} total={r.leads} />}
          href="/app/leads"
        />
        <Figure
          label={cc.wait}
          value={r.medianDays === null ? '·' : cc.days.replace('{n}', String(r.medianDays))}
        />
      </div>
      <p className="mt-3 text-body text-ink-mute">{cc.count.replace('{n}', String(r.leads))}</p>
    </section>
  );
}
