'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addPayment, togglePaid, deletePayment, type MoneyResult } from '@/app/actions/money';
import { appCopy } from '@/content/site';

export type Payment = {
  id: string; title: string; amount: number;
  due_on: string | null; paid: boolean; paid_on: string | null;
};

const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(due);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) < today;
}

function Add() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? appCopy.money.payAdding : appCopy.money.payAdd}
    </button>
  );
}

export function PaymentsPanel({ clientId, payments, viewer }: {
  clientId: string; payments: Payment[]; viewer: 'producer' | 'client';
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(addPayment, null);
  const c = appCopy.money;

  const paid = payments.filter((p) => p.paid).reduce((a, p) => a + Number(p.amount), 0);
  const owed = payments.filter((p) => !p.paid).reduce((a, p) => a + Number(p.amount), 0);

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.payTitle}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">
        {viewer === 'producer' ? c.paySubProducer : c.paySubClient}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 px-4 py-3">
          <div className="text-[12.5px] text-emerald-700">{c.totalPaid}</div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-emerald-800">{ils(paid)}</div>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-3">
          <div className="text-[12.5px] text-amber-800">{c.totalOwed}</div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-amber-900">{ils(owed)}</div>
        </div>
        <div className="rounded-2xl bg-ivory-200 px-4 py-3">
          <div className="text-[12.5px] text-ink-mute">{c.totalAll}</div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-ink">{ils(paid + owed)}</div>
        </div>
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
        <p role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-800">
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
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
                late ? 'border-rose-200 bg-rose-50/40' : 'border-line'
              }`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-ink">{p.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-mute">
                    {p.paid
                      ? `${c.paid}${p.paid_on ? ' · ' + dateFmt.format(new Date(p.paid_on)) : ''}`
                      : (
                        <span className={late ? 'font-semibold text-rose-700' : ''}>
                          {p.due_on ? dateFmt.format(new Date(p.due_on)) : c.noDue}
                          {late ? ` · ${c.overdue}` : ''}
                        </span>
                      )}
                  </p>
                </div>

                <span className={`tabular-nums text-[15px] font-semibold ${p.paid ? 'text-emerald-700' : 'text-ink'}`}>
                  {ils(Number(p.amount))}
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
                  <span className={`rounded-full px-3 py-1 text-[12.5px] ${
                    p.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
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
