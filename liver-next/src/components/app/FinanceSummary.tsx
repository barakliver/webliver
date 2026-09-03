'use client';

import { useActionState, useState } from 'react';
import { ChevronDown, Info, Pencil, Target, Wallet, Receipt, Scale, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { setBudgetTarget, type MoneyResult } from '@/app/actions/money';
import { useCopy } from '@/components/app/CopyProvider';
import { Money } from '@/components/Ltr';
import { cn } from '@/lib/utils';
import { summarise } from '@/lib/finance';
import type { BudgetItem } from './BudgetPanel';
import type { Payment } from './PaymentsPanel';

/**
 * How the money is worked out, on one screen, with the working shown.
 *
 * Five figures and one sentence. The figures are the ones a couple asks for
 * in this order: what did we say we would spend, what have we signed for,
 * what have we actually paid, what is left to pay, and are we inside the
 * number we started with. The sentence under them is the arithmetic, in
 * words, because a figure whose derivation is hidden is a figure nobody
 * trusts, and the whole point of showing the couple their money is trust.
 *
 *   committed = Σ agreed price of every budget line, or its estimate while
 *               nothing is agreed yet
 *   paid      = Σ payments marked paid
 *   remaining = committed − paid, never below zero
 *   variance  = target − committed, when a target exists
 *
 * The bar is the same arithmetic as a shape: the paid share, the pending
 * share, the whole being what was committed.
 */
export function FinanceSummary({ clientId, viewer, target, items, payments }: {
  clientId: string;
  viewer: 'producer' | 'client';
  target: number | null;
  items: BudgetItem[];
  payments: Payment[];
}) {
  const c = useCopy().money.finance;
  const [explain, setExplain] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<MoneyResult | null, FormData>(
    async (prev, form) => {
      const r = await setBudgetTarget(prev, form);
      if (r.ok) setEditing(false);
      return r;
    },
    null,
  );

  /* The arithmetic lives in one tested module rather than here, so the
     figures the couple reads and the figures the assistant quotes are the
     same figures. */
  const { committed, paid, remaining, variance, underTarget, paidPct, pendingPct } =
    summarise(items, payments, target);

  const tiles: { key: string; icon: LucideIcon; kicker: string; value: React.ReactNode; sub?: string; tone?: string }[] = [
    {
      key: 'target', icon: Target, kicker: c.target,
      value: target === null ? <span className="text-ink-mute">{c.noTarget}</span> : <Money value={target} />,
      sub: c.targetSub,
    },
    { key: 'committed', icon: Receipt, kicker: c.committed, value: <Money value={committed} />, sub: c.committedSub },
    { key: 'paid', icon: Wallet, kicker: c.paid, value: <Money value={paid} />, sub: c.paidSub, tone: 'text-ok' },
    { key: 'remaining', icon: Scale, kicker: c.remaining, value: <Money value={remaining} />, sub: c.remainingSub, tone: 'text-warn' },
  ];

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        <button
          type="button" onClick={() => setExplain((v) => !v)} aria-expanded={explain}
          title={c.formula}
          className="btn-quiet inline-flex min-h-[38px] items-center gap-1.5 px-2.5 text-[13.5px]"
        >
          <Info size={15} strokeWidth={1.5} aria-hidden />
          {c.how}
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn('transition-transform', explain && 'rotate-180')} />
        </button>
      </div>

      {/* The working, in words and as a sum. Open on request rather than
          always, because once it has been read once it is furniture. */}
      {explain && (
        <div className="mt-4 rounded-xl2 border border-accent-line/40 bg-accent-wash px-4 py-3.5">
          <p className="text-[14px] leading-relaxed text-ink">{c.formula}</p>
          <p className="mt-2 text-[13px] tabular-nums text-ink-soft" dir="ltr">
            <Money value={committed} /> − <Money value={paid} /> = <Money value={remaining} />
          </p>
          {target !== null && (
            <p className="mt-1 text-[13px] tabular-nums text-ink-soft" dir="ltr">
              <Money value={target} /> − <Money value={committed} /> = <Money value={Math.abs(variance ?? 0)} />{underTarget === false ? ' ⚠' : ''}
            </p>
          )}
        </div>
      )}

      {/* Five tiles. The fifth is the verdict, so it gets the colour. */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-xl2 border border-line bg-surface-100 p-4">
            <p className="inline-flex items-center gap-1.5 text-[11.5px] tracking-[.12em] text-ink-mute">
              <t.icon size={13} strokeWidth={1.5} aria-hidden />
              {t.kicker}
            </p>
            <p className={cn('mt-2 font-display text-[24px] font-semibold leading-none tabular-nums', t.tone ?? 'text-ink')}>
              {t.value}
            </p>
            {t.sub && <p className="mt-2 text-[12px] leading-snug text-ink-mute">{t.sub}</p>}
          </div>
        ))}

        <div
          className={cn(
            'rounded-xl2 border p-4',
            variance === null
              ? 'border-line bg-surface-100'
              : underTarget ? 'border-ok/30 bg-ok-wash' : 'border-bad/30 bg-bad-wash',
          )}
        >
          <p className="inline-flex items-center gap-1.5 text-[11.5px] tracking-[.12em] text-ink-mute">
            {underTarget === false
              ? <TriangleAlert size={13} strokeWidth={1.5} aria-hidden />
              : <ShieldCheck size={13} strokeWidth={1.5} aria-hidden />}
            {variance === null ? c.variance : underTarget ? c.surplus : c.overrun}
          </p>
          <p className={cn(
            'mt-2 font-display text-[24px] font-semibold leading-none tabular-nums',
            variance === null ? 'text-ink-mute' : underTarget ? 'text-ok' : 'text-bad',
          )}>
            {variance === null ? <span className="text-[16px]">{c.setTargetFirst}</span> : <Money value={Math.abs(variance)} />}
          </p>
          {variance !== null && (
            <span className={cn(
              'mt-2 inline-block rounded-xl2 px-2 py-0.5 text-[11.5px] font-medium',
              underTarget ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad',
            )}>
              {underTarget ? c.underBadge : c.overBadge}
            </span>
          )}
        </div>
      </div>

      {/* The bar: paid on the start side, pending after it, the whole being
          the commitment. Two colours the legend names, no third state. */}
      <div className="mt-6">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-200" role="img" aria-label={`${c.paid} ${paidPct}%`}>
          <span className="h-full bg-ok transition-[width] duration-700" style={{ width: `${paidPct}%` }} />
          <span className="h-full bg-warn/70 transition-[width] duration-700" style={{ width: `${pendingPct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-mute">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-ok" />
            {c.paidShare} <span className="tabular-nums" dir="ltr">{paidPct}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-warn/70" />
            {c.pendingShare} <span className="tabular-nums" dir="ltr">{pendingPct}%</span>
          </span>
        </div>
      </div>

      {/* The one editable number here. Everything else is derived from the
          budget lines and the payments, which have their own panels. */}
      {viewer === 'producer' && (
        <div className="mt-5">
          {editing ? (
            <form action={action} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="client_id" value={clientId} />
              <div>
                <label className="label" htmlFor={`target-${clientId}`}>{c.target}</label>
                <input
                  id={`target-${clientId}`} name="budget_target" type="number" min={0} step="100" inputMode="numeric"
                  defaultValue={target ?? ''} dir="ltr" className="field w-[200px]" autoFocus
                />
              </div>
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost">{c.cancel}</button>
              {state && !state.ok && state.error && <p role="alert" className="w-full text-[13.5px] text-bad">{state.error}</p>}
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="btn-quiet inline-flex items-center gap-1.5 px-0 text-[13.5px]">
              <Pencil size={14} strokeWidth={1.5} aria-hidden />
              {target === null ? c.setTarget : c.editTarget}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
