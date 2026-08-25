'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addBudgetItem, deleteBudgetItem, toggleBudgetVisible, type MoneyResult } from '@/app/actions/money';
import { appCopy } from '@/content/site';

export type BudgetItem = {
  id: string; category: string; label: string;
  estimate: number; agreed: number | null; vendor: string;
};

const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');

function Add() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? appCopy.money.payAdding : appCopy.money.budAdd}
    </button>
  );
}

export function BudgetPanel({ clientId, items, viewer, visible }: {
  clientId: string; items: BudgetItem[]; viewer: 'producer' | 'client'; visible: boolean;
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(addBudgetItem, null);
  const c = appCopy.money;

  const totalEst = items.reduce((a, i) => a + (Number(i.estimate) || 0), 0);
  /* A line with nothing agreed yet still costs its estimate, so the comparison
     is like for like instead of flattering whatever has not been booked. */
  /* One missing number would otherwise make the whole column read ₪NaN,
     which is worse than reading zero because it looks like a bug in the app
     rather than a gap in the data. */
  const totalAgreed = items.reduce((a, i) => a + (Number(i.agreed ?? i.estimate) || 0), 0);
  const diff = totalEst - totalAgreed;

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.budTitle}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.budSub}</p>
        </div>

        {viewer === 'producer' && (
          <form action={toggleBudgetVisible}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="visible" value={String(visible)} />
            <button type="submit" className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
              visible ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
            }`}>
              {visible ? c.budVisible : c.budHidden}
            </button>
          </form>
        )}
      </div>

      {viewer === 'producer' && !visible && (
        <p className="mt-4 rounded-2xl bg-surface-200 px-4 py-3 text-[13.5px] text-ink-soft">{c.budHiddenNote}</p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-200 px-4 py-3">
          <div className="text-[12.5px] text-ink-mute">{c.budTotalEst}</div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-ink">{ils(totalEst)}</div>
        </div>
        <div className="rounded-2xl bg-accent-wash px-4 py-3">
          <div className="text-[12.5px] text-accent">{c.budTotalAgreed}</div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-ink">{ils(totalAgreed)}</div>
        </div>
        <div className={`rounded-2xl px-4 py-3 ${diff >= 0 ? 'bg-ok-wash' : 'bg-bad-wash'}`}>
          <div className={`text-[12.5px] ${diff >= 0 ? 'text-ok' : 'text-bad'}`}>
            {diff >= 0 ? c.budUnder : c.budOver}
          </div>
          <div className={`font-display text-[22px] font-semibold tabular-nums ${diff >= 0 ? 'text-ok' : 'text-bad'}`}>
            {ils(Math.abs(diff))}
          </div>
        </div>
      </div>

      {viewer === 'producer' && (
        <form action={action} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_130px_130px_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <input name="label" required placeholder={c.budLabelPh} autoComplete="off" className="field" aria-label={c.budLabel} />
          <input name="vendor" placeholder={c.budVendor} autoComplete="off" className="field" aria-label={c.budVendor} />
          <input name="estimate" required type="number" min={0} inputMode="numeric" placeholder={c.budEstimate} className="field" aria-label={c.budEstimate} />
          <input name="agreed" type="number" min={0} inputMode="numeric" placeholder={c.budAgreed} className="field" aria-label={c.budAgreed} />
          <Add />
        </form>
      )}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-2xl border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.budNone}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-right text-[14.5px]">
            <thead>
              <tr className="border-b border-line text-[12.5px] text-ink-mute">
                <th scope="col" className="py-2 font-medium">{c.budLabel}</th>
                <th scope="col" className="py-2 font-medium">{c.budVendor}</th>
                <th scope="col" className="py-2 font-medium">{c.budEstimate}</th>
                <th scope="col" className="py-2 font-medium">{c.budAgreed}</th>
                {viewer === 'producer' && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-line last:border-0">
                  <td className="py-3 font-medium text-ink">{i.label}</td>
                  <td className="py-3 text-ink-soft">{i.vendor || '—'}</td>
                  <td className="py-3 tabular-nums text-ink-soft">{ils(Number(i.estimate))}</td>
                  <td className="py-3 tabular-nums text-ink">{i.agreed === null ? '—' : ils(Number(i.agreed))}</td>
                  {viewer === 'producer' && (
                    <td className="py-3">
                      <form action={deleteBudgetItem}>
                        <input type="hidden" name="item_id" value={i.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
