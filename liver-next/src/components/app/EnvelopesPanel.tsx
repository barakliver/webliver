'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Plus, Check, Pencil } from 'lucide-react';
import { addEnvelope, removeEnvelope, toggleDelivered, updateEnvelope, type EnvelopeResult } from '@/app/actions/envelopes';
import type { EnvelopesCopy } from '@/content/appUi';
import { Money } from '@/components/Ltr';
import { DeleteForm } from '@/components/app/ConfirmDelete';

export type Envelope = {
  id: string;
  label: string;
  amount: number | null;
  recipient: string;
  cash: boolean;
  delivered_at: string | null;
  note: string;
};

/** The envelopes: the cash the couple brings on the night, and whether each
 *  one has been handed over.
 *
 *  Written by either side and read by the event manager with the bag in
 *  hand, so the list is the whole point and the form stays under it. The
 *  total at the top is the number the couple takes to the bank the day
 *  before; the tick on each row is the manager's, on the night. */
export function EnvelopesPanel({ c, clientId, items }: {
  c: EnvelopesCopy; clientId: string; items: Envelope[];
}) {
  const [state, action, pending] = useActionState<EnvelopeResult | null, FormData>(addEnvelope, null);
  const total = items.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const handed = items.filter((e) => e.delivered_at).length;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-display text-subhead font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-body text-ink-soft">{c.sub}</p>
        </div>
        {items.length > 0 && (
          <p className="text-body text-ink-mute">
            <span className="font-display text-panel font-semibold text-ink"><Money value={total} /></span>
            {' · '}{c.handed.replace('{n}', String(handed)).replace('{of}', String(items.length))}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-body text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((e) => (
            <Row key={e.id} c={c} clientId={clientId} e={e} />
          ))}
        </ul>
      )}

      <form action={action} className="mt-5 border-t border-line pt-4">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_130px]">
          <label>
            <span className="label">{c.label}</span>
            <input name="label" required maxLength={80} placeholder={c.labelPh} className="field mt-1 w-full" />
          </label>
          <label>
            <span className="label">{c.recipient}</span>
            <input name="recipient" maxLength={80} placeholder={c.recipientPh} className="field mt-1 w-full" />
          </label>
          <label>
            <span className="label">{c.amount}</span>
            <input name="amount" type="number" inputMode="decimal" min={0} step="0.01" className="field mt-1 w-full" />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
          <label>
            <span className="label">{c.how}</span>
            <select name="cash" defaultValue="true" className="field mt-1 w-full">
              <option value="true">{c.cash}</option>
              <option value="false">{c.transfer}</option>
            </select>
          </label>
          <label>
            <span className="label">{c.note}</span>
            <input name="note" maxLength={400} placeholder={c.notePh} className="field mt-1 w-full" />
          </label>
        </div>
        <Submit c={c} pending={pending} />
        {state?.ok === false && state.error && (
          <p role="status" className="mt-2 text-body text-bad">{state.error}</p>
        )}
      </form>
    </section>
  );
}

function Submit({ c, pending }: { c: EnvelopesCopy; pending: boolean }) {
  const { pending: busy } = useFormStatus();
  const wait = pending || busy;
  return (
    <button type="submit" disabled={wait} className="btn-primary mt-3 px-4 text-body">
      {wait
        ? <Loader2 size={15} strokeWidth={1.5} aria-hidden className="animate-spin" />
        : <Plus size={15} strokeWidth={1.5} aria-hidden />}
      {wait ? c.adding : c.add}
    </button>
  );
}

/** One envelope, and the form that corrects it. */
function Row({ c, clientId, e }: { c: EnvelopesCopy; clientId: string; e: Envelope }) {
  const [editing, setEditing] = useState(false);

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-card-sm border px-3 py-3 ${
        e.delivered_at ? 'border-ok/25 bg-ok-wash/40' : 'border-line'
      }`}
    >
      <form action={toggleDelivered} className="flex items-center">
        <input type="hidden" name="id" value={e.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="delivered" value={String(!!e.delivered_at)} />
        <button
          type="submit"
          aria-label={e.delivered_at ? c.markUndelivered : c.markDelivered}
          aria-pressed={!!e.delivered_at}
          className="-my-2 -mx-1 flex h-11 w-8 items-center justify-center"
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
              e.delivered_at ? 'border-ok/30 bg-ok text-surface' : 'border-line-strong bg-card hover:border-ink'
            }`}
          >
            {e.delivered_at && <Check size={13} strokeWidth={2} />}
          </span>
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`text-lead ${e.delivered_at ? 'text-ink-mute' : 'text-ink'}`}>
          {e.label}
          {e.recipient && <span className="text-ink-soft"> · {e.recipient}</span>}
        </p>
        <p className="mt-0.5 text-meta text-ink-mute">
          {e.cash ? c.cash : c.transfer}
          {e.note ? ` · ${e.note}` : ''}
        </p>
      </div>

      <span className="font-display text-head font-semibold tabular-nums text-ink">
        {e.amount === null ? '·' : <Money value={e.amount} />}
      </span>

      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
        aria-label={c.edit}
        title={c.edit}
        className="btn-quiet grid size-9 shrink-0 place-items-center px-0 py-0"
      >
        <Pencil size={15} strokeWidth={1.5} aria-hidden />
      </button>

      <DeleteForm action={removeEnvelope}>
        <input type="hidden" name="id" value={e.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" className="btn-quiet px-3 py-1 text-body">{c.remove}</button>
      </DeleteForm>

      {editing && <EditEnvelope c={c} clientId={clientId} e={e} onDone={() => setEditing(false)} />}
    </li>
  );
}

function SaveEdit({ c }: { c: EnvelopesCopy }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? c.editSaving : c.editSave}
    </button>
  );
}

/**
 * Correcting an envelope in place.
 *
 * The amount is agreed late and changes twice before the night, and the name
 * on it is written from somebody's memory of what the band is called. Until
 * now the only way to fix either was to delete the row and write it again,
 * which lost the stamp saying when it was handed over — the one question
 * this list exists to answer.
 *
 * Handing it over stays the tick on the left. A form that could also mark an
 * envelope delivered is a form that marks one delivered by accident, and
 * for this row that is how a rabbi gets paid twice.
 */
function EditEnvelope({ c, clientId, e, onDone }: {
  c: EnvelopesCopy; clientId: string; e: Envelope; onDone: () => void;
}) {
  const [state, action] = useActionState<EnvelopeResult | null, FormData>(
    async (prev, form) => {
      const r = await updateEnvelope(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={action} className="mt-3 w-full border-t border-line pt-3">
      <input type="hidden" name="id" value={e.id} />
      <input type="hidden" name="client_id" value={clientId} />

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_130px]">
        <label>
          <span className="label">{c.label}</span>
          <input name="label" required maxLength={80} defaultValue={e.label} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="label">{c.recipient}</span>
          <input name="recipient" maxLength={80} defaultValue={e.recipient} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="label">{c.amount}</span>
          <input
            name="amount" type="number" inputMode="decimal" min={0} step="0.01"
            defaultValue={e.amount ?? ''} className="field mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
        <label>
          <span className="label">{c.how}</span>
          <select name="cash" defaultValue={String(e.cash)} className="field mt-1 w-full">
            <option value="true">{c.cash}</option>
            <option value="false">{c.transfer}</option>
          </select>
        </label>
        <label>
          <span className="label">{c.note}</span>
          <input name="note" maxLength={400} defaultValue={e.note} className="field mt-1 w-full" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <SaveEdit c={c} />
        <button type="button" onClick={onDone} className="btn-quiet px-3 py-1 text-body">{c.editCancel}</button>
      </div>

      {state?.ok === false && state.error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}
