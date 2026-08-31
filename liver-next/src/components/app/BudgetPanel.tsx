'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addBudgetItem, deleteBudgetItem, toggleBudgetVisible, type MoneyResult } from '@/app/actions/money';
import { useCopy } from '@/components/app/CopyProvider';
import { Money, ils } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';
import { ReceiptScan } from '@/components/app/ReceiptScan';

export type BudgetItem = {
  id: string; category: string; label: string;
  estimate: number; agreed: number | null; vendor: string;
};


function Add() {
  const c = useCopy().money;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? c.payAdding : c.budAdd}
    </button>
  );
}

export function BudgetPanel({ clientId, items, viewer, visible }: {
  clientId: string; items: BudgetItem[]; viewer: 'producer' | 'client'; visible: boolean;
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(addBudgetItem, null);
  const c = useCopy().money;
  /* The scanner writes into this form by name, so the two have to agree on
     one id, and it has to be unique per event on a page that can show more
     than one. */
  const formId = `budget-${clientId}`;

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
          <h2 className="font-display text-[18px] font-light text-ink">{c.budTitle}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.budSub}</p>
        </div>

        {viewer === 'producer' && (
          <form action={toggleBudgetVisible}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="visible" value={String(visible)} />
            <button type="submit" className={`rounded-xl2 px-4 py-2 text-[13px] font-medium transition ${
              visible ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
            }`}>
              {visible ? c.budVisible : c.budHidden}
            </button>
          </form>
        )}
      </div>

      {viewer === 'producer' && !visible && (
        <p className="mt-4 rounded-xl2 bg-surface-200 px-4 py-3 text-[13.5px] text-ink-soft">{c.budHiddenNote}</p>
      )}

      <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-3">
        <Metric kicker={c.budTotalEst} value={<Money value={totalEst} />} />
        <Metric kicker={c.budTotalAgreed} value={<Money value={totalAgreed} />} tone="accent" />
        <Metric
          kicker={diff >= 0 ? c.budUnder : c.budOver}
          value={<Money value={Math.abs(diff)} />}
          tone={diff >= 0 ? 'ok' : 'bad'}
        />
      </div>

      {viewer === 'producer' && (
        <form id={formId} action={action} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_130px_130px_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <input name="label" required placeholder={c.budLabelPh} autoComplete="off" className="field" aria-label={c.budLabel} />
          <input name="vendor" placeholder={c.budVendor} autoComplete="off" className="field" aria-label={c.budVendor} />
          <input name="estimate" required type="number" min={0} inputMode="numeric" placeholder={c.budEstimate} className="field" aria-label={c.budEstimate} />
          <input name="agreed" type="number" min={0} inputMode="numeric" placeholder={c.budAgreed} className="field" aria-label={c.budAgreed} />
          <Add />
        </form>
      )}

      {/* Under the form rather than above it, because it fills that form and
          does not replace it. Every field it writes is still a field somebody
          can type over, and nothing is saved until the same button as always
          is pressed. */}
      {viewer === 'producer' && <ReceiptScan clientId={clientId} formId={formId} />}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.budNone}</p>
      ) : (
        <>
        {/* Cards on a phone, the table from the small breakpoint up. Four money
            columns with a 520px minimum meant a thumb dragging sideways inside
            a page that also scrolls down, on the screen a couple is most likely
            to read their budget on. */}
        <ul className="mt-5 space-y-2.5 sm:hidden">
          {items.map((i) => (
            <li key={i.id} className="rounded-xl2 border border-line px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{i.label}</p>
                  {i.vendor && <p className="text-[12.5px] text-ink-mute">{i.vendor}</p>}
                </div>
                {/* The agreed figure is the one that matters once it exists, so
                    it is the one that gets the size; the estimate sits under it
                    as what it was before somebody negotiated. */}
                <div className="shrink-0 text-left">
                  <p className="font-display text-[16px] font-light tabular-nums text-ink">
                    <Money value={i.agreed === null ? Number(i.estimate) : Number(i.agreed)} />
                  </p>
                  {i.agreed !== null && Number(i.agreed) !== Number(i.estimate) && (
                    <p className="text-[12px] tabular-nums text-ink-mute">
                      {c.budEstimate} <Money value={Number(i.estimate)} />
                    </p>
                  )}
                </div>
              </div>
              {viewer === 'producer' && (
                <form action={deleteBudgetItem} className="mt-2">
                  <input type="hidden" name="item_id" value={i.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-5 hidden overflow-x-auto sm:block">
          <table className="w-full text-right text-[14.5px]">
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
                  <td className="py-3 text-ink-soft">{i.vendor || '·'}</td>
                  <td className="py-3 tabular-nums text-ink-soft"><Money value={Number(i.estimate)} /></td>
                  <td className="py-3 tabular-nums text-ink">
                    {i.agreed === null ? '·' : <Money value={Number(i.agreed)} />}
                  </td>
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
        </>
      )}
    </section>
  );
}
