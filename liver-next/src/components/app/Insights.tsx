import Link from 'next/link';
import { appCopy } from '@/content/site';
import type { Funnel, SourceRow, Response, Cash } from '@/lib/analytics';
import { Money, Ratio, ils } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';

const c = appCopy.insights;

/** A rate, or the reason there isn't one. Never a percentage sign with three
 *  cases behind it. */
function Rate({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[12.5px] font-medium text-ink-mute">{c.thin}</span>;
  }
  return (
    <span className="text-[12.5px] font-semibold tabular-nums text-accent">
      {value}% <span className="font-normal text-ink-mute">{c.ofPrev}</span>
    </span>
  );
}

const LABELS: Record<string, string> = {
  leads: c.funnel.leads,
  contacted: c.funnel.contacted,
  meeting: c.funnel.meeting,
  won: c.funnel.won,
};

/**
 * The funnel as bars, measured against the top rather than against each other.
 *
 * Each step's width is its share of all enquiries, so the narrowing is the
 * information. A chart where every bar is scaled to its own step is a chart
 * where nothing ever looks like it is being lost.
 */
export function FunnelChart({ funnel }: { funnel: Funnel }) {
  const top = Math.max(funnel.total, 1);
  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-light text-ink">{c.funnel.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.funnel.sub}</p>

      <ul className="mt-5 list-none space-y-3 p-0">
        {funnel.steps.map((s, i) => (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-medium text-ink">{LABELS[s.key] ?? s.key}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[17px] font-semibold tabular-nums text-ink">{s.count}</span>
                {i > 0 && <Rate value={s.rate} />}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-200">
              <div
                className="h-full rounded-none bg-accent transition-[width] duration-500"
                style={{ width: `${Math.round((s.count / top) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[12.5px] text-ink-mute">{c.thinHint}</p>
    </section>
  );
}

export function Sources({ rows }: { rows: SourceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-light text-ink">{c.sources.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.sources.sub}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[380px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-line text-[12.5px] text-ink-mute">
              <th className="py-2 text-start font-medium">{c.sources.source}</th>
              <th className="py-2 text-start font-medium">{c.sources.leads}</th>
              <th className="py-2 text-start font-medium">{c.sources.won}</th>
              <th className="py-2 text-start font-medium">{c.sources.rate}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} className="border-b border-line last:border-0">
                <td className="py-2.5 text-ink">{r.source === 'unknown' ? c.sources.unknown : r.source}</td>
                <td className="py-2.5 tabular-nums text-ink-soft">{r.leads}</td>
                <td className="py-2.5 tabular-nums text-ink-soft">{r.won}</td>
                <td className="py-2.5">
                  {r.rate === null
                    ? <Ratio of={r.won} total={r.leads} className="text-[12.5px] text-ink-mute" />
                    : <span className="font-semibold tabular-nums text-accent">{r.rate}%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One figure, big, with the thing it is a figure about under it. */
function Figure({ label, value, tone = 'ink', note }: {
  /* ReactNode rather than string: an amount arrives as <Money>, which is an
     element, because a bare shekel string inside a Hebrew page renders with
     the sign on the wrong side. */
  label: string; value: React.ReactNode; tone?: 'ink' | 'ok' | 'warn' | 'bad'; note?: string;
}) {
  /* No box. On this palette a figure is a figure and a hairline separates
     it from the next one; the filled tile it used to sit in belonged to the
     version with cards. The tone stays on the numeral, where it is measured
     against the ivory rather than against a wash. */
  return <Metric kicker={label} value={value} sub={note} tone={tone} />;
}

export function CashPanel({ cash }: { cash: Cash }) {
  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-light text-ink">{c.cash.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.cash.sub}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Figure label={c.cash.collected} value=<Money value={cash.collected} /> tone="ok" />
        <Figure label={c.cash.due} value=<Money value={cash.due} /> />
        <Figure
          label={c.cash.overdue}
          value=<Money value={cash.overdue} />
          tone={cash.overdue > 0 ? 'bad' : 'ink'}
          note={cash.overdueCount > 0 ? c.cash.overdueCount(cash.overdueCount) : undefined}
        />
      </div>
    </section>
  );
}

export function ResponsePanel({ r }: { r: Response }) {
  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-light text-ink">{c.response.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.response.sub}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Figure
          label={c.response.median}
          value={r.medianHours === null ? '·' : c.response.hours(r.medianHours)}
          note={r.medianHours === null ? c.response.none : undefined}
        />
        <Figure label={c.response.answered} value={String(r.answered)} />
        <Figure
          label={c.response.waiting}
          value={String(r.waiting)}
          tone={r.waiting > 0 ? 'warn' : 'ok'}
        />
      </div>
    </section>
  );
}

export function Health({ signed, overdue, waiting }: {
  signed: { signed: number; of: number }; overdue: number; waiting: number;
}) {
  const clear = overdue === 0 && waiting === 0;
  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-light text-ink">{c.health.title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Figure label={c.health.signed} value={<Ratio of={signed.signed} total={signed.of} />} />
        <Figure label={c.health.overdueTasks} value={String(overdue)} tone={overdue > 0 ? 'bad' : 'ok'} />
        <Figure label={c.health.waiting} value={String(waiting)} tone={waiting > 0 ? 'warn' : 'ok'} />
      </div>

      {clear ? (
        <p className="mt-4 text-[14px] text-ink-soft">{c.health.clear}</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Links rather than status chips. A chip reports a state; these
              take you somewhere, and dressing one as the other is how a person
              learns not to tap either. */}
          {waiting > 0 && <Link href="/app/leads" className="btn-ghost">{c.health.toLeads}</Link>}
          {overdue > 0 && <Link href="/app/clients" className="btn-ghost">{c.health.toClients}</Link>}
        </div>
      )}
    </section>
  );
}
