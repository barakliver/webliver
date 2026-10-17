'use client';

import { Pencil } from 'lucide-react';

import { isPastDue } from '@/lib/clock';

import { useActionState, useState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { addPayment, togglePaid, deletePayment, updatePayment, settlePayment, type MoneyResult } from '@/app/actions/money';
import { paymentFlow } from '@/lib/paymentFlow';
import { PAY_METHODS, JOINT_PAYER } from '@/lib/payMethods';
import { todayInZone } from '@/lib/clock';
import { useCopy } from '@/components/app/CopyProvider';
import { shortDate } from '@/lib/appDates';
import { Money, ils } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { sumIls } from '@/lib/money';

export type Payment = {
  id: string; title: string; amount: number;
  due_on: string | null; paid: boolean; paid_on: string | null;
  /** One of the couple's names, or `JOINT_PAYER`. Empty or absent: not said. */
  paid_by?: string | null;
  /** One of `PAY_METHODS`. Empty or absent: not said. */
  method?: string | null;
};


/** Late where the event is, so one instalment cannot read as overdue on the
 *  producer's phone and on time on the server that rendered the same row. */
const isOverdue = (due: string | null): boolean => isPastDue(due);

/* Date inputs on a phone have an intrinsic width of their own and ignore the
   column they are in, which is how the due date on the add form ran off the
   left edge of a 390px screen. Width and min-width are stated, and the native
   appearance is dropped, which is what makes iOS listen to them. */
const DATE_FIELD = 'field w-full min-w-0 max-w-full appearance-none';

/** Which of the two paid, or both. The two names come from the event's own
 *  name; where it does not read as two names the choice is joint alone, and a
 *  value already on the row that is no longer in the list stays on it, so
 *  correcting a spelling never silently reassigns an old payment. */
function PayerSelect({ names, defaultValue = '', name = 'paid_by' }: {
  names: string[]; defaultValue?: string | null; name?: string;
}) {
  const c = useCopy().money;
  const current = defaultValue ?? '';
  const known = current === '' || current === JOINT_PAYER || names.includes(current);
  return (
    <select name={name} defaultValue={current} className="field w-full min-w-0 max-w-full">
      <option value="">{c.payWhoNone}</option>
      {names.map((n) => <option key={n} value={n}>{n}</option>)}
      <option value={JOINT_PAYER}>{c.payJoint}</option>
      {!known && <option value={current}>{current}</option>}
    </select>
  );
}

function MethodSelect({ defaultValue = '' }: { defaultValue?: string | null }) {
  const c = useCopy().money;
  return (
    <select name="method" defaultValue={defaultValue ?? ''} className="field w-full min-w-0 max-w-full">
      <option value="">{c.payMethodNone}</option>
      {PAY_METHODS.map((m) => <option key={m} value={m}>{c.methods[m]}</option>)}
    </select>
  );
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

/**
 * Correcting a payment in place.
 *
 * The three fields that move — what it is for, how much, and when — and
 * deliberately not whether it was paid. That is the button beside it, and
 * keeping them apart is the whole point: a date slips on an instalment that
 * has already been settled, and before this the only way to fix it was to
 * delete the row, which deleted the record that the money arrived.
 */
function EditPayment({ payment, clientId, names, onDone }: {
  payment: Payment; clientId: string; names: string[]; onDone: () => void;
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
          <input name="title" required defaultValue={payment.title} autoComplete="off" className="field"  enterKeyHint="next" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payAmount}</span>
          <input
            name="amount" required type="number" min={0} step="0.01" inputMode="decimal"
            defaultValue={Number(payment.amount)} className="field"
           autoComplete="off" enterKeyHint="next" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payDue}</span>
          <input name="due_on" type="date" defaultValue={payment.due_on ?? ''} className={DATE_FIELD} autoComplete="off" enterKeyHint="done" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payMethod}</span>
          <MethodSelect defaultValue={payment.method} />
        </label>
        {/* Only on a settled one: who paid and on what day are facts about
            money that moved, and an open instalment has neither yet. */}
        {payment.paid && (
          <>
            <label className="min-w-0">
              <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payWho}</span>
              <PayerSelect names={names} defaultValue={payment.paid_by} />
            </label>
            <label className="col-span-2 min-w-0 sm:col-span-1">
              <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payPaidOn}</span>
              <input name="paid_on" type="date" defaultValue={payment.paid_on ?? ''} className={DATE_FIELD} autoComplete="off" />
            </label>
          </>
        )}
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

export function PaymentsPanel({ clientId, payments, viewer, eventDate = null, names = [] }: {
  clientId: string; payments: Payment[]; viewer: 'producer' | 'client';
  /** The evening, for the cut between before and after. Null: no cut. */
  eventDate?: string | null;
  /** The couple's two names, for "who paid". Empty: joint is the only choice. */
  names?: string[];
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(addPayment, null);
  const ui = useCopy();
  const c = ui.money;
  const dateFmt = shortDate(ui.locale);

  const paid = payments.filter((p) => p.paid).reduce((a, p) => a + Number(p.amount), 0);
  const owed = payments.filter((p) => !p.paid).reduce((a, p) => a + Number(p.amount), 0);

  return (
    <section className="card">
      <h2 className="head-panel">{c.payTitle}</h2>
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
            <input name="title" required placeholder={c.payWhatPh} autoComplete="off" className="field"  enterKeyHint="next" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payAmount}</span>
            <input name="amount" required type="number" min="0.01" step="0.01" inputMode="decimal" className="field"  autoComplete="off" enterKeyHint="next" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payDue}</span>
            <input name="due_on" type="date" className={DATE_FIELD} autoComplete="off" enterKeyHint="done" />
          </label>
          <label className="col-span-2 min-w-0 lg:col-span-1">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payMethod}</span>
            <MethodSelect />
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
            <PaymentRow key={p.id} payment={p} clientId={clientId} names={names} />
          ))}
        </ul>
      )}

      {/* Under the list rather than above the form: the form and the rows are
          what is pressed, and this is what is read once they are right. */}
      {payments.length > 0 && <Flow payments={payments} eventDate={eventDate} />}
    </section>
  );
}

/** One instalment, and the form that corrects it. */
function PaymentRow({ payment: p, clientId, names }: { payment: Payment; clientId: string; names: string[] }) {
  const ui = useCopy();
  const c = ui.money;
  const dateFmt = shortDate(ui.locale);
  const [editing, setEditing] = useState(false);
  const [settling, setSettling] = useState(false);
  const late = !p.paid && isOverdue(p.due_on);

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-card-sm border px-4 py-3 ${
      late ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
    }`}>
      <div className="min-w-0 flex-1">
        <p className="text-lead text-ink">{p.title}</p>
        <p className="mt-0.5 text-meta text-ink-mute">
          {p.paid
            ? [
                `${c.paid}${p.paid_on ? ' · ' + formatDate(dateFmt, p.paid_on, '') : ''}`,
                p.paid_by ? `${c.paidBy} ${p.paid_by === JOINT_PAYER ? c.payJoint : p.paid_by}` : '',
                p.method && (PAY_METHODS as readonly string[]).includes(p.method) ? c.methods[p.method as (typeof PAY_METHODS)[number]] : '',
              ].filter(Boolean).join(' · ')
            : (
              <span className={late ? 'font-medium text-bad' : ''}>
                {formatDate(dateFmt, p.due_on, c.noDue)}
                {late ? ` · ${c.overdue}` : ''}
              </span>
            )}
        </p>
      </div>

      <span className={`tabular-nums text-lead font-medium ${p.paid ? 'text-ok' : 'text-ink'}`}>
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

        {p.paid ? (
          <form action={togglePaid}>
            <input type="hidden" name="payment_id" value={p.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="paid" value="true" />
            <button type="submit" className="btn-ghost px-3 py-1.5 text-body">{c.markUnpaid}</button>
          </form>
        ) : (
          /* Settling asks three small things - the day, who, how - so it is
             a form that opens rather than a button that flips. */
          <button
            type="button" onClick={() => setSettling((v) => !v)} aria-expanded={settling}
            className="btn-ghost px-3 py-1.5 text-body"
          >
            {c.markPaid}
          </button>
        )}
        <DeleteForm action={deletePayment}>
          <input type="hidden" name="payment_id" value={p.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <button type="submit" className="btn-quiet px-2 py-1.5 text-body">{c.remove}</button>
        </DeleteForm>
      </div>

      {settling && !p.paid && (
        <SettlePayment payment={p} clientId={clientId} names={names} onDone={() => setSettling(false)} />
      )}
      {editing && (
        <EditPayment payment={p} clientId={clientId} names={names} onDone={() => setEditing(false)} />
      )}
    </li>
  );
}

/**
 * Saying that an instalment was paid, and filling in the three things a
 * producer is asked about it: the day the money moved, which of the two paid,
 * and how. The day starts as today, in the event's time zone, and is the one
 * thing that is usually wrong by a few days, which is why it is a field and
 * not a stamp.
 */
function SettlePayment({ payment, clientId, names, onDone }: {
  payment: Payment; clientId: string; names: string[]; onDone: () => void;
}) {
  const c = useCopy().money;
  const [state, action] = useActionState<MoneyResult | null, FormData>(
    async (prev, form) => {
      const r = await settlePayment(prev, form);
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
        <label className="col-span-2 min-w-0 sm:col-span-1">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payPaidOn}</span>
          <input name="paid_on" type="date" required defaultValue={todayInZone()} className={DATE_FIELD} autoComplete="off" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payWho}</span>
          <PayerSelect names={names} />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.payMethod}</span>
          <MethodSelect defaultValue={payment.method} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <SettleSave />
        <button type="button" onClick={onDone} className="btn-quiet px-2 py-1 text-body">{c.budCancel}</button>
      </div>
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SettleSave() {
  const c = useCopy().money;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.budSaving : c.settleSave}</button>;
}

/**
 * The money cut at the evening: what went out before the wedding, what is
 * still due by then, what is expected after it, and the paid part of it by how
 * and by whom. Computed by `paymentFlow`, which is pure and tested; this only
 * draws it.
 */
function Flow({ payments, eventDate }: { payments: Payment[]; eventDate: string | null }) {
  const c = useCopy().money;
  const f = c.flow;
  const flow = paymentFlow(payments.map((p) => ({ ...p, amount: Number(p.amount) })), eventDate);

  const methodLabel = (k: string) =>
    k === '' ? f.unsaid : (PAY_METHODS as readonly string[]).includes(k) ? c.methods[k as (typeof PAY_METHODS)[number]] : k;
  const payerLabel = (k: string) => (k === '' ? f.unsaid : k === JOINT_PAYER ? c.payJoint : k);

  const half = (title: string, h: { paid: number; due: number }) => (
    <div className="min-w-0 rounded-card-sm bg-surface-100 p-4">
      <p className="eyebrow">{title}</p>
      <dl className="mt-2 space-y-1.5 text-body">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-soft">{f.paidLabel}</dt>
          <dd className="tabular-nums text-ink"><Money value={h.paid} /></dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-soft">{f.dueLabel}</dt>
          <dd className="tabular-nums text-ink"><Money value={h.due} /></dd>
        </div>
      </dl>
    </div>
  );

  const rows = (title: string, list: { key: string; amount: number }[], label: (k: string) => string) =>
    list.length === 0 ? null : (
      <div className="min-w-0">
        <p className="eyebrow">{title}</p>
        <ul className="mt-2 list-none space-y-1.5 p-0 text-body">
          {list.map((r) => (
            <li key={r.key || 'unsaid'} className="flex items-baseline justify-between gap-3">
              <span className="text-ink-soft">{label(r.key)}</span>
              <span className="tabular-nums text-ink"><Money value={r.amount} /></span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="head-sub">{f.title}</h3>
      <p className="mt-1 text-body text-ink-mute">{f.sub}</p>

      {flow.split ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {half(f.before, flow.before)}
          {half(f.after, flow.after)}
        </div>
      ) : (
        <p className="mt-4 text-body text-ink-soft">{f.noEventDate}</p>
      )}

      {flow.undated > 0 && (
        <p className="mt-3 flex items-baseline justify-between gap-3 text-body text-ink-soft">
          <span>{f.undated}</span>
          <span className="tabular-nums text-ink"><Money value={flow.undated} /></span>
        </p>
      )}

      {(flow.byMethod.length > 0 || flow.byPayer.length > 0) && (
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {rows(f.byMethod, flow.byMethod, methodLabel)}
          {rows(f.byPayer, flow.byPayer, payerLabel)}
        </div>
      )}
    </div>
  );
}
