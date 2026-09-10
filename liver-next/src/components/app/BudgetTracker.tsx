'use client';

import { TriangleAlert } from 'lucide-react';
import { count as plural, fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';
import { Money, ils } from '@/components/Ltr';
import { shortDate } from '@/lib/appDates';
import { todayInZone } from '@/lib/clock';
import { track, weekly, type BudgetPlan, type TrackItem, type WeekPayment } from '@/lib/budgetPlan';

/**
 * Planned against booked, one row per area, and the flag at the top.
 *
 * The flag is the reason the tracker exists. A table somebody has to read
 * to discover they are over is a table that discovers it a month late; an
 * area past its figure by more than a tenth is named above the table, with
 * a trade-off beside it, before the eye reaches a number. The three lines
 * at the bottom are the same three the Sunday letter carries.
 */
export function BudgetTracker({ items, payments, plan, target }: {
  items: (TrackItem & { created_at?: string | null })[];
  payments: WeekPayment[];
  plan: BudgetPlan | null;
  target: number | null;
}) {
  const ui = useCopy();
  const c = ui.money.plan;
  const dateFmt = shortDate(ui.locale);
  const t = track(items, plan);
  const w = weekly(items, payments, plan, target, todayInZone());
  const cat = (k: keyof typeof c.categories) => c.categories[k];

  if (t.rows.length === 0 && !plan) return null;

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.trackerTitle}</h2>
      <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.trackerSub}</p>

      {t.flagged.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl2 border border-bad/30 bg-bad-wash px-4 py-3">
          {t.flagged.map((r) => (
            <p key={r.key} className="flex items-start gap-2 text-[14px] text-bad">
              <TriangleAlert size={16} aria-hidden strokeWidth={1.5} className="mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">{fill(c.overTitle, { cat: cat(r.key), pct: r.pct - 100 })}</strong>
                {' '}{fill(c.overBody, { actual: ils(r.actual), planned: ils(r.planned) })}
              </span>
            </p>
          ))}
          <p className="mt-2 text-[13.5px] text-ink">
            {t.tradeOff
              ? fill(c.tradeOff, { cat: cat(t.tradeOff.cut), amount: ils(t.tradeOff.headroom) })
              : c.tradeOffNone}
          </p>
        </div>
      )}

      {!plan && <p className="mt-4 rounded-xl2 bg-surface-200 px-4 py-3 text-[13.5px] text-ink-soft">{c.trackerNoPlan}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-[12.5px] text-ink-mute">
              <th scope="col" className="py-2 text-start font-medium">{c.colArea}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colPlanned}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colActual}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colRemaining}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colUsed}</th>
              <th scope="col" className="hidden py-2 text-start font-medium sm:table-cell">{c.colNotes}</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => {
              const red = r.key === 'contingency';
              return (
                <tr key={r.key} className={`border-b border-line last:border-0 ${red ? 'text-bad' : r.over ? 'bg-bad-wash/40 text-ink' : 'text-ink'}`}>
                  <td className="py-2.5 pe-3 font-medium">{cat(r.key)}</td>
                  <td className="py-2.5 pe-3 tabular-nums">{r.planned > 0 ? <Money value={r.planned} /> : '·'}</td>
                  <td className="py-2.5 pe-3 tabular-nums">{r.actual > 0 ? <Money value={r.actual} /> : '·'}</td>
                  <td className={`py-2.5 pe-3 tabular-nums ${r.remaining < 0 ? 'font-semibold text-bad' : ''}`}>
                    {r.planned > 0 ? <Money value={r.remaining} /> : '·'}
                  </td>
                  <td className={`py-2.5 pe-3 tabular-nums ${r.over ? 'font-semibold text-bad' : ''}`}>{r.planned > 0 ? `${r.pct}%` : '·'}</td>
                  <td className="hidden py-2.5 text-[12.5px] text-ink-mute sm:table-cell">
                    {r.lines === 0 ? c.nothingBooked : plural(c.lines, r.lines)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {t.planned > 0 && (
            <tfoot>
              <tr className="border-t border-line-strong font-semibold text-ink">
                <td className="py-2.5 pe-3">{ui.money.budTotalAgreed}</td>
                <td className="py-2.5 pe-3 tabular-nums"><Money value={t.planned} /></td>
                <td className="py-2.5 pe-3 tabular-nums"><Money value={t.actual} /></td>
                <td className={`py-2.5 pe-3 tabular-nums ${t.planned - t.actual < 0 ? 'text-bad' : ''}`}><Money value={t.planned - t.actual} /></td>
                <td className="py-2.5 pe-3 tabular-nums">{Math.round((t.actual / t.planned) * 100)}%</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* The three lines. */}
      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-[13.5px] font-semibold text-ink">{c.weekTitle}</h3>
        <ol className="mt-2 space-y-1 text-[14px] leading-relaxed text-ink-soft">
          <li>
            {w.overall.target && w.overall.pct !== null
              ? fill(c.overall, { committed: ils(w.overall.committed), target: ils(w.overall.target), pct: w.overall.pct })
              : fill(c.overallNoTarget, { committed: ils(w.overall.committed) })}
          </li>
          <li>{w.watch ? fill(c.watch, { cat: cat(w.watch.key), pct: w.watch.pct }) : c.watchNone}</li>
          <li>
            {w.nextDue
              ? fill(c.nextDue, { title: w.nextDue.title, amount: ils(w.nextDue.amount), date: dateFmt.format(new Date(`${w.nextDue.on}T12:00:00Z`)) })
              : c.nextDueNone}
          </li>
        </ol>
        <p className="mt-3 text-[12.5px] text-ink-mute">{c.digestNote}</p>
      </div>
    </section>
  );
}
