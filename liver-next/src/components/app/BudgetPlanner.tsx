'use client';

import { useMemo, useState } from 'react';
import { PieChart, Check } from 'lucide-react';
import { fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';
import { Money, ils } from '@/components/Ltr';
import { saveBudgetPlan, type PlanResult } from '@/app/actions/budgetPlan';
import { allocate, PLAN_CATEGORIES, type BudgetPlan, type PlanCategory } from '@/lib/budgetPlan';

type Stance = 'neutral' | 'must' | 'nice';

/**
 * The split before the spending.
 *
 * A budget screen that only lists what was booked cannot say whether the
 * photographer is expensive: expensive compared to what? This is the "what":
 * a total, and for each area whether the couple would rather overspend on
 * it or cut it first. The table answers live as they decide, with a reason
 * beside every figure that moved, so a split is something they argued with
 * rather than something they were handed.
 */
export function BudgetPlanner({ clientId, current, target, guestEstimate, defaultOpen = false }: {
  clientId: string; current: BudgetPlan | null; target: number | null; guestEstimate: number | null;
  /** Open on arrival. The gallery uses it; the money tab does not. */
  defaultOpen?: boolean;
}) {
  const c = useCopy().money.plan;
  const [open, setOpen] = useState(defaultOpen);
  const [total, setTotal] = useState<string>(String(current?.total ?? target ?? ''));
  const [guests, setGuests] = useState<string>(String(current?.guests ?? guestEstimate ?? ''));
  const [stance, setStance] = useState<Partial<Record<PlanCategory, Stance>>>(() => {
    const s: Partial<Record<PlanCategory, Stance>> = {};
    for (const k of current?.must ?? []) s[k] = 'must';
    for (const k of current?.nice ?? []) s[k] = 'nice';
    return s;
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);

  const must = PLAN_CATEGORIES.filter((k) => stance[k] === 'must');
  const nice = PLAN_CATEGORIES.filter((k) => stance[k] === 'nice');
  const totalN = Number(total);
  const guestsN = Number(guests);

  const alloc = useMemo(
    () => allocate({
      total: Number.isFinite(totalN) && totalN > 0 ? totalN : 0,
      guests: Number.isFinite(guestsN) && guestsN > 0 ? guestsN : null,
      must, nice,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totalN, guestsN, must.join(','), nice.join(',')],
  );

  const cycle = (k: PlanCategory) => setStance((prev) => {
    const cur = prev[k] ?? 'neutral';
    const next: Stance = cur === 'neutral' ? 'must' : cur === 'must' ? 'nice' : 'neutral';
    return { ...prev, [k]: next };
  });

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const r = await saveBudgetPlan(clientId, { total: totalN, guests: guestsN, must, nice });
    setBusy(false);
    setResult(r);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl2 border border-line-strong bg-card px-4 py-2.5 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
      >
        <PieChart size={16} aria-hidden strokeWidth={1.5} />
        {c.open}
      </button>
    );
  }

  const reason = (l: { base: number; pct: number; moved: 'must' | 'nice' | 'shift' | null }) => {
    const vars = { from: l.base, to: l.pct };
    if (l.moved === 'must') return fill(c.reasonMust, vars);
    if (l.moved === 'nice') return fill(c.reasonNice, vars);
    if (l.moved === 'shift') return fill(c.reasonShift, vars);
    return c.reasonSame;
  };

  const stanceClass = (s: Stance) =>
    s === 'must' ? 'border-ok bg-ok-wash text-ok'
      : s === 'nice' ? 'border-warn bg-warn-wash text-warn'
        : 'border-line bg-card text-ink-soft';

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setOpen(false)}>{c.close}</button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-[12.5px] text-ink-mute">
          {c.total}
          <input type="number" inputMode="numeric" min={0} step={1000} value={total}
            onChange={(e) => setTotal(e.target.value)} className="field mt-1 w-full" />
        </label>
        <label className="text-[12.5px] text-ink-mute">
          {c.guests}
          <input type="number" inputMode="numeric" min={0} value={guests}
            onChange={(e) => setGuests(e.target.value)} className="field mt-1 w-full" />
        </label>
      </div>

      <h3 className="mt-6 text-[13px] font-semibold text-accent">{c.pick}</h3>
      <p className="mt-1 max-w-prose2 text-[12.5px] leading-relaxed text-ink-mute">{c.pickHint}</p>
      {/* One button per area that cycles through the three stances, with the
          word on it. A row of three radio buttons per area is thirty controls
          on a phone; this is ten. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PLAN_CATEGORIES.filter((k) => k !== 'contingency').map((k) => {
          const s = stance[k] ?? 'neutral';
          return (
            <button
              key={k} type="button" onClick={() => cycle(k)}
              aria-pressed={s !== 'neutral'}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl2 border px-3 text-[13.5px] transition ${stanceClass(s)}`}
            >
              <span>{c.categories[k]}</span>
              <span className="text-[11.5px] opacity-80">{s === 'must' ? c.must : s === 'nice' ? c.nice : c.neutral}</span>
            </button>
          );
        })}
      </div>

      {totalN > 0 && (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-[12.5px] text-ink-mute">
                  <th scope="col" className="py-2 text-start font-medium">{c.colArea}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colBase}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colPct}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colAmount}</th>
                  <th scope="col" className="hidden py-2 text-start font-medium sm:table-cell">{c.colWhy}</th>
                </tr>
              </thead>
              <tbody>
                {alloc.lines.map((l) => (
                  <tr key={l.key} className={`border-b border-line last:border-0 ${l.key === 'contingency' ? 'text-bad' : 'text-ink'}`}>
                    <td className="py-2.5 pe-3 font-medium">{c.categories[l.key]}</td>
                    <td className="py-2.5 pe-3 tabular-nums text-ink-mute">{l.base}%</td>
                    <td className={`py-2.5 pe-3 tabular-nums ${l.moved ? 'font-semibold' : ''}`}>{l.pct}%</td>
                    <td className="py-2.5 pe-3 tabular-nums"><Money value={l.amount} /></td>
                    <td className="hidden py-2.5 text-[12.5px] text-ink-mute sm:table-cell">{reason(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {alloc.perHead !== null && (
            <p className="mt-3 text-[13.5px] text-ink-soft">{fill(c.perHead, { n: ils(alloc.perHead) })}</p>
          )}
          <p className="mt-2 max-w-prose2 text-[12.5px] leading-relaxed text-ink-mute">{c.basis}</p>
        </>
      )}

      {result && !result.ok && (
        <p role="alert" className="mt-4 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {result.error ?? c.failed}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="mt-4 inline-flex items-center gap-2 rounded-xl2 border border-ok/30 bg-ok-wash px-4 py-2.5 text-[14px] text-ok">
          <Check size={15} aria-hidden strokeWidth={1.5} />
          {c.saved}
        </p>
      )}

      <div className="mt-4">
        <button type="button" onClick={save} disabled={busy || !(totalN > 0)} className="btn-primary">
          {busy ? c.saving : c.save}
        </button>
      </div>
    </section>
  );
}
