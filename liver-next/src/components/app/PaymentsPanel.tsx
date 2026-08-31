'use client';

import { useActionState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { addPayment, togglePaid, deletePayment, type MoneyResult } from '@/app/actions/money';
import { useCopy } from '@/components/app/CopyProvider';
import { shortDate } from '@/lib/appDates';
import { Money, ils } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';

export type Payment = {
  id: string; title: string; amount: number;
  due_on: string | null; paid: boolean; paid_on: string | null;
};


function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(due);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) < today;
}

function Add() {
  const ui = useCopy();
  const c = ui.money;
  const dateFmt = shortDate(ui.locale);
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? c.payAdding : c.payAdd}
    </button>
  );
}

export function PaymentsPanel({ clientId, payments, viewer }: {
  clientId: string; payments: Payment[]; viewer: 'producer' | 'client';
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(addPayment, null);
  const ui = useCopy();
  const c = ui.money;
  const dateFmt = shortDate(ui.locale);

  const paid = payments.filter((p) => p.paid).reduce((a, p) => a + Number(p.amount), 0);
  const owed = payments.filter((p) => !p.paid).reduce((a, p) => a + Number(p.amount), 0);

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-light text-ink">{c.payTitle}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">
        {viewer === 'producer' ? c.paySubProducer : c.paySubClient}
      </p>

      <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-3">
        <Metric kicker={c.totalPaid} value={<Money value={paid} />} tone="ok" />
        <Metric kicker={c.totalOwed} value={<Money value={owed} />} tone="warn" />
        <Metric kicker={c.totalAll} value={<Money value={paid + owed} />} />
      </div>

      {viewer === 'producer' && (
        <form action={action} className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_150px_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <input name="title" required placeholder={c.payWhatPh} autoComplete="off" className="field" aria-label={c.payWhat} />
          <input name="amount" required type="number" min={1} inputMode="numeric" placeholder={c.payAmount} className="field" aria-label={c.payAmount} />
          <input name="due_on" type="date" className="field" aria-label={c.payDue} />
          <Add />
        </form>
      )}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}

      {payments.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.payNone}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {payments.map((p) => {
            const late = !p.paid && isOverdue(p.due_on);
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl2 border px-4 py-3 ${
                late ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
              }`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-ink">{p.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-mute">
                    {p.paid
                      ? `${c.paid}${p.paid_on ? ' · ' + formatDate(dateFmt, p.paid_on, '') : ''}`
                      : (
                        <span className={late ? 'font-semibold text-bad' : ''}>
                          {formatDate(dateFmt, p.due_on, c.noDue)}
                          {late ? ` · ${c.overdue}` : ''}
                        </span>
                      )}
                  </p>
                </div>

                <span className={`tabular-nums text-[15px] font-semibold ${p.paid ? 'text-ok' : 'text-ink'}`}>
                  <Money value={Number(p.amount)} />
                </span>

                {viewer === 'producer' ? (
                  <div className="flex gap-2">
                    <form action={togglePaid}>
                      <input type="hidden" name="payment_id" value={p.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="paid" value={String(p.paid)} />
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-[13px]">
                        {p.paid ? c.markUnpaid : c.markPaid}
                      </button>
                    </form>
                    <form action={deletePayment}>
                      <input type="hidden" name="payment_id" value={p.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <button type="submit" className="btn-quiet px-2 py-1.5 text-[13px]">{c.remove}</button>
                    </form>
                  </div>
                ) : (
                  <span className={`rounded-xl2 px-3 py-1 text-[12.5px] ${
                    p.paid ? 'bg-ok-wash text-ok' : 'bg-warn-wash text-warn'
                  }`}>
                    {p.paid ? c.paid : c.unpaid}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
