import Link from 'next/link';
import { CheckSquare, Coins, CircleAlert } from 'lucide-react';
import { appCopy } from '@/content/site';
import type { EventSummary as Summary } from '@/lib/eventSummary';

const c = appCopy.clientPage;

const shekels = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' });

/** Compared on calendar dates so something due today never reads as late. */
function overdue(due: string | null): boolean {
  if (!due) return false;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(due);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) < today;
}

function Tile({ label, value, tone = 'plain', sub }: {
  label: string; value: string; sub?: string; tone?: 'plain' | 'warn' | 'good';
}) {
  const colour =
    tone === 'warn' ? 'text-rose-700' : tone === 'good' ? 'text-emerald-700' : 'text-ink';
  return (
    <div className="rounded-2xl border border-line px-4 py-3.5">
      <div className="text-[12.5px] text-ink-mute">{label}</div>
      <div className={`mt-1 font-display text-[22px] font-semibold tabular-nums leading-none ${colour}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-mute">{sub}</div>}
    </div>
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t.guests}
          value={guests.total === 0 ? t.none : String(guests.confirmed)}
          sub={guests.total === 0 ? undefined
            : `${t.confirmed} · ${guests.seats} ${t.seats} · ${guests.pending} ${t.pending}`}
          tone={guests.confirmed > 0 ? 'good' : 'plain'}
        />
        <Tile
          label={t.owed}
          value={money.owed === 0 ? t.none : shekels(money.owed)}
          sub={money.paid > 0 ? `${t.paid} ${shekels(money.paid)}` : undefined}
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
            ? `${t.contracts} ${summary.contracts.signed}/${summary.contracts.total}`
            : undefined}
        />
      </div>

      {money.overdue > 0 && (
        <p className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-800">
          <CircleAlert size={16} aria-hidden strokeWidth={1.75} />
          {t.overdue} {shekels(money.overdue)}
        </p>
      )}

      <div className="card">
        <h2 className="font-display text-[18px] font-semibold text-ink">{c.nextUp}</h2>
        {next.length === 0 ? (
          <p className="mt-3 text-[14.5px] text-ink-mute">{c.nextUpNone}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {next.map((item) => {
              const late = overdue(item.due);
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
                    late ? 'border-rose-200 bg-rose-50/40' : 'border-line'
                  }`}
                >
                  <span className={late ? 'text-rose-700' : 'text-ink-mute'} aria-hidden>
                    {item.kind === 'task'
                      ? <CheckSquare size={16} strokeWidth={1.75} />
                      : <Coins size={16} strokeWidth={1.75} />}
                  </span>
                  <span className="min-w-0 flex-1 text-[14.5px] text-ink">{item.title}</span>
                  {item.amount !== undefined && item.amount > 0 && (
                    <span className="text-[13.5px] tabular-nums text-ink-soft">{shekels(item.amount)}</span>
                  )}
                  <span className={`text-[13px] tabular-nums ${late ? 'text-rose-700' : 'text-ink-mute'}`}>
                    {item.due ? dateFmt.format(new Date(item.due)) : t.none}
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
