'use client';

import { Pencil } from 'lucide-react';

import { isPastDue } from '@/lib/clock';

import { useActionState, useState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { addPayment, togglePaid, deletePayment, updatePayment, type MoneyResult } from '@/app/actions/money';
import { useCopy } from '@/components/app/CopyProvider';
import { shortDate } from '@/lib/appDates';
import { Money, ils } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { sumIls } from '@/lib/money';

export type Payment = {
  id: string; title: string; amount: number;
  due_on: string | null; paid: boolean; paid_on: string | null;
};


/** Late where the event is, so one instalment cannot read as overdue on the
 *  producer's phone and on time on the server that rendered the same row. */
const isOverdue = (due: string | null): boolean => isPastDue(due);

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

/**
 * Correcting a payment in place.
 *
 * The three fields that move — what it is for, how much, and when — and
 * deliberately not whether it was paid. That is the button beside it, and
 * keeping them apart is the whole point: a date slips on an instalment that
 * has already been settled, and before this the only way to fix it was to
 * delete the row, which deleted the record that the money arrived.
 */
function EditPayment({ payment, clientId, onDone }: {
  payment: Payment; clientId: string; onDone: () => void;
}) {
  const c = useCopy().money;
  const [state, action] = useActionState<MoneyResult | null, FormData>(
    async (prev, form) => {
      const r = await updatePayment(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={action} className="mt-3 w-full border-t border-line pt-3">
      <input type="hidden" name="payment_id" value={payment.id} />
      <input type="hidden" name="client_id" value={clientId} />

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payWhat}</span>
          <input name="title" required defaultValue={payment.title} autoComplete="off" className="field" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payAmount}</span>
          <input
            name="amount" required type="number" min={0} step="0.01" inputMode="decimal"
            defaultValue={Number(payment.amount)} className="field"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payDue}</span>
          <input name="due_on" type="date" defaultValue={payment.due_on ?? ''} className="field" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Save />
        <button type="button" onClick={onDone} className="btn-quiet px-2 py-1 text-body">
          {c.budCancel}
        </button>
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Save() {
  const c = useCopy().money;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.budSaving : c.budSave}
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
      <h2 className="font-display text-subhead font-semibold text-ink">{c.payTitle}</h2>
      <p className="mt-1 text-body text-ink-soft">
        {viewer === 'producer' ? c.paySubProducer : c.paySubClient}
      </p>

      {/* Suppressed until a payment exists, for the same reason the budget's
          totals are: a paid total and an outstanding total, both written as
          zero, on an event where no payment has been recorded at all. Three
          figures describing nothing, and one of them a reassurance about
          owing nothing that nobody has earned yet. */}
      {payments.length > 0 && (
        <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-3">
          <Metric kicker={c.totalPaid} value={<Money value={paid} />} tone="ok" />
          <Metric kicker={c.totalOwed} value={<Money value={owed} />} tone="warn" />
          <Metric kicker={c.totalAll} value={<Money value={sumIls([paid, owed])} />} />
        </div>
      )}

      {/* Both sides may add a payment and mark one paid: the couple is the
          one who made the transfer. */}
      {/* Each field says what it is above itself rather than inside itself.
            A placeholder is gone at exactly the moment somebody looks up to
            check which box they are in, and on a phone, where these stack
            into three identical boxes, that is every time. The date field
            never had even a placeholder: it read `mm/dd/yyyy` and nothing
            said what the date was for. */}
        <form action={action} className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <input type="hidden" name="client_id" value={clientId} />

          <label className="col-span-2 min-w-0 lg:col-span-1">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payWhat}</span>
            <input name="title" required placeholder={c.payWhatPh} autoComplete="off" className="field" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payAmount}</span>
            <input name="amount" required type="number" min="0.01" step="0.01" inputMode="decimal" className="field" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payDue}</span>
            <input name="due_on" type="date" className="field" />
          </label>

          <div className="col-span-2 lg:col-span-3">
            <Add />
          </div>
        </form>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}

      {payments.length === 0 ? (
        <p className="mt-6 text-body text-ink-mute">{c.payNone}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} clientId={clientId} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One instalment, and the form that corrects it. */
function PaymentRow({ payment: p, clientId }: { payment: Payment; clientId: string }) {
  const ui = useCopy();
  const c = ui.money;
  const dateFmt = shortDate(ui.locale);
  const [editing, setEditing] = useState(false);
  const late = !p.paid && isOverdue(p.due_on);

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-card-sm border px-4 py-3 ${
      late ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
    }`}>
      <div className="min-w-0 flex-1">
        <p className="text-lead text-ink">{p.title}</p>
        <p className="mt-0.5 whitespace-nowrap text-meta text-ink-mute">
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

      <span className={`tabular-nums text-lead font-semibold ${p.paid ? 'text-ok' : 'text-ink'}`}>
        <Money value={Number(p.amount)} />
      </span>

      {/* On a phone the buttons take the next line, so the title and the
          date stop being squeezed into a column three characters wide. */}
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        {/* Correcting what the payment says, which is a different act from
            saying it arrived — and the reason the two are not one button is
            that the row carries `paid` and `paid_on`, so until this existed
            fixing a date on a settled payment meant deleting the record
            that the money moved. */}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="grid size-9 place-items-center rounded-control text-ink-mute transition-colors hover:bg-surface-200 hover:text-ink"
          aria-label={c.payEdit}
          title={c.payEdit}
        >
          <Pencil size={15} strokeWidth={1.5} aria-hidden />
        </button>

        <form action={togglePaid}>
          <input type="hidden" name="payment_id" value={p.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="paid" value={String(p.paid)} />
          <button type="submit" className="btn-ghost px-3 py-1.5 text-body">
            {p.paid ? c.markUnpaid : c.markPaid}
          </button>
        </form>
        <DeleteForm action={deletePayment}>
          <input type="hidden" name="payment_id" value={p.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <button type="submit" className="btn-quiet px-2 py-1.5 text-body">{c.remove}</button>
        </DeleteForm>
      </div>

      {editing && (
        <EditPayment payment={p} clientId={clientId} onDone={() => setEditing(false)} />
      )}
    </li>
  );
}
