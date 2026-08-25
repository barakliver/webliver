import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckSquare, Coins, CircleAlert } from 'lucide-react';
import { Money, Ratio } from '@/components/Ltr';
import { appCopy } from '@/content/site';
import type { EventSummary as Summary } from '@/lib/eventSummary';
import { formatDate, isOverdue } from '@/lib/dates';
import { Metric } from '@/components/app/Metric';

const c = appCopy.clientPage;

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' });

function Tile({ label, value, tone = 'plain', sub }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: 'plain' | 'warn' | 'good';
}) {
  return (
    <Metric
      kicker={label}
      value={value}
      sub={sub}
      tone={tone === 'warn' ? 'bad' : tone === 'good' ? 'ok' : 'ink'}
    />
  );
}

/**
 * What this event looks like right now, above everything else in its file.
 *
 * The tiles are the questions asked out loud before anything is opened: how
 * many are actually coming, how much is still out, what is late. Underneath
 * them is the single list a producer works from, tasks and payments together
 * and soonest first, because the next move is whichever is nearest and
 * splitting them into two lists hands that decision back to the reader.
 */
export function EventSummary({ clientId, summary }: { clientId: string; summary: Summary }) {
  const t = c.at;
  const { guests, money, next } = summary;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-4">
        <Tile
          label={t.guests}
          value={guests.total === 0 ? t.none : String(guests.confirmed)}
          sub={guests.total === 0 ? undefined
            : `${t.confirmed} · ${guests.seats} ${t.seats} · ${guests.pending} ${t.pending}`}
          tone={guests.confirmed > 0 ? 'good' : 'plain'}
        />
        <Tile
          label={t.owed}
          value={money.owed === 0 ? t.none : <Money value={money.owed} />}
          sub={money.paid > 0 ? <>{t.paid} <Money value={money.paid} /></> : undefined}
          tone={money.overdue > 0 ? 'warn' : 'plain'}
        />
        <Tile
          label={t.tasksOpen}
          value={summary.tasksOpen === 0 ? t.none : String(summary.tasksOpen)}
        />
        <Tile
          label={t.dayLines}
          value={summary.dayLines === 0 ? t.none : String(summary.dayLines)}
          sub={summary.contracts.total > 0
            ? <>{t.contracts} <Ratio of={summary.contracts.signed} total={summary.contracts.total} /></>
            : undefined}
        />
      </div>

      {money.overdue > 0 && (
        <p className="inline-flex items-center gap-2 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          <CircleAlert size={16} aria-hidden strokeWidth={1.5} />
          {t.overdue} <Money value={money.overdue} />
        </p>
      )}

      <div className="card">
        <h2 className="font-display text-[18px] font-light text-ink">{c.nextUp}</h2>
        {next.length === 0 ? (
          <p className="mt-3 text-[14.5px] text-ink-mute">{c.nextUpNone}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {next.map((item) => {
              const late = isOverdue(item.due);
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className={`flex flex-wrap items-center gap-3 rounded-xl2 border px-4 py-3 ${
                    late ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
                  }`}
                >
                  <span className={late ? 'text-bad' : 'text-ink-mute'} aria-hidden>
                    {item.kind === 'task'
                      ? <CheckSquare size={16} strokeWidth={1.5} />
                      : <Coins size={16} strokeWidth={1.5} />}
                  </span>
                  <span className="min-w-0 flex-1 text-[14.5px] text-ink">{item.title}</span>
                  {item.amount !== undefined && item.amount > 0 && (
                    <Money value={item.amount} className="text-[13.5px] tabular-nums text-ink-soft" />
                  )}
                  <span className={`text-[13px] tabular-nums ${late ? 'text-bad' : 'text-ink-mute'}`}>
                    {formatDate(dateFmt, item.due, t.none)}
                  </span>
                  <Link
                    href={`/app/clients/${clientId}?tab=${item.kind === 'task' ? 'tasks' : 'money'}`}
                    className="btn-quiet px-3 py-1 text-[13px]"
                  >
                    {c.openTab}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
