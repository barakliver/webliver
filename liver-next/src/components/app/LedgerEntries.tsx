'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil } from 'lucide-react';

import { useCopy } from '@/components/app/CopyProvider';
import { Money } from '@/components/Ltr';
import { shortDate } from '@/lib/appDates';
import { removeLedgerEntry, updateLedgerEntry, type LedgerResult } from '@/app/actions/ledger';
import { DeleteForm } from '@/components/app/ConfirmDelete';

export type LedgerEntry = {
  id: string;
  client_id: string | null;
  kind: 'income' | 'expense';
  amount: number;
  label: string;
  party: string;
  note: string;
  on_date: string;
  event_name: string | null;
};

/** Only enough of an event to put it in a select. */
export type LedgerEvent = { id: string; name: string };

/** What the plus recorded, with three totals. On the event's money tab it
 *  is that event's entries; on insights it is everything, newest first. */
export function LedgerEntries({ entries, showEvent = true, events = [] }: {
  entries: LedgerEntry[]; showEvent?: boolean; events?: LedgerEvent[];
}) {
  const ui = useCopy();
  const c = ui.quickLedger;
  const income = entries.filter((e) => e.kind === 'income').reduce((a, e) => a + e.amount, 0);
  const expense = entries.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0);

  return (
    <section className="card">
      <h2 className="head-panel">{c.listTitle}</h2>
      <p className="mt-1 max-w-prose2 text-body leading-relaxed text-ink-soft">{c.listSub}</p>

      {entries.length === 0 ? (
        <p className="mt-5 text-body text-ink-mute">{c.listNone}</p>
      ) : (
        <>
          <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-3">
            <div><p className="eyebrow">{c.totalIn}</p><p className="mt-1 font-display text-panel font-semibold text-ok"><Money value={income} /></p></div>
            <div><p className="eyebrow">{c.totalOut}</p><p className="mt-1 font-display text-panel font-semibold text-bad"><Money value={expense} /></p></div>
            <div><p className="eyebrow">{c.net}</p><p className={`mt-1 font-display text-panel font-semibold ${income - expense < 0 ? 'text-bad' : 'text-ink'}`}><Money value={income - expense} /></p></div>
          </div>
          {/* A year of entries is hundreds of rows, and this panel is also
              drawn whole on the insights screen where it is every event at
              once. */}
          <ul className="rows mt-5 divide-y divide-line border-t border-line">
            {entries.map((e) => (
              <Row key={e.id} entry={e} showEvent={showEvent} events={events} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** One entry, and the form that corrects it. */
function Row({ entry: e, showEvent, events }: {
  entry: LedgerEntry; showEvent: boolean; events: LedgerEvent[];
}) {
  const ui = useCopy();
  const c = ui.quickLedger;
  const dateFmt = shortDate(ui.locale);
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-body">
      <span className="w-[76px] shrink-0 tabular-nums text-ink-mute">{dateFmt.format(new Date(`${e.on_date}T12:00:00Z`))}</span>
      <span className="min-w-0 flex-1">
        <span className="text-ink">{e.label}</span>
        <span className="block text-meta text-ink-mute">
          {showEvent ? (e.event_name ?? e.party ?? c.unattached) : e.party}
          {e.note ? ` · ${e.note}` : ''}
        </span>
      </span>
      <span className={`shrink-0 tabular-nums font-medium ${e.kind === 'income' ? 'text-ok' : 'text-bad'}`}>
        {e.kind === 'expense' ? '-' : ''}<Money value={e.amount} />
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
      <DeleteForm action={removeLedgerEntry}>
        <input type="hidden" name="id" value={e.id} />
        <input type="hidden" name="client_id" value={e.client_id ?? ''} />
        <button type="submit" className="btn-quiet px-2 py-1 text-body">{c.remove}</button>
      </DeleteForm>

      {editing && <EditEntry entry={e} events={events} onDone={() => setEditing(false)} />}
    </li>
  );
}

function Save() {
  const c = useCopy().quickLedger;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.editSaving : c.editSave}</button>;
}

/**
 * Correcting an entry in place.
 *
 * Every field the sheet wrote, including which half of the toggle it went
 * into and which event it belongs to. The event matters most: the sheet's
 * own words are that the thing most often recorded here is the one with no
 * file to attach it to, so the ordinary life of an entry is to be written
 * against nothing in a car park and attached a week later. Without this the
 * only way to do that was to delete the line and retype five fields from
 * memory.
 *
 * The event select is only drawn where the screen was handed a list of
 * events. On the event's own money tab there is one answer and it is
 * already the right one.
 */
function EditEntry({ entry: e, events, onDone }: {
  entry: LedgerEntry; events: LedgerEvent[]; onDone: () => void;
}) {
  const c = useCopy().quickLedger;
  const [kind, setKind] = useState<'income' | 'expense'>(e.kind);
  const [state, action] = useActionState<LedgerResult | null, FormData>(
    async (prev, form) => {
      const r = await updateLedgerEntry(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={action} className="mt-3 w-full border-t border-line pt-3">
      <input type="hidden" name="id" value={e.id} />
      <input type="hidden" name="kind" value={kind} />
      {/* Where the entry was, so the screen it is leaving is refreshed too. */}
      <input type="hidden" name="was_client_id" value={e.client_id ?? ''} />
      {events.length === 0 && <input type="hidden" name="client_id" value={e.client_id ?? ''} />}

      <div className="inline-flex rounded-control border border-line bg-surface-100 p-1 text-body" role="radiogroup" aria-label={c.editTitle}>
        {(['income', 'expense'] as const).map((k) => (
          <button
            key={k} type="button" role="radio" aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-[40px] flex-1 rounded-control px-4 transition ${kind === k ? (k === 'income' ? 'bg-ok-wash font-medium text-ok' : 'bg-bad-wash font-medium text-bad') : 'text-ink-mute'}`}
          >
            {k === 'income' ? c.income : c.expense}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.amount}</span>
          <input
            name="amount" required type="number" min="0.01" step="0.01" inputMode="decimal"
            defaultValue={e.amount} className="field"
           autoComplete="off" enterKeyHint="next" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.date}</span>
          <input name="on_date" type="date" defaultValue={e.on_date} className="field"  autoComplete="off" enterKeyHint="next" />
        </label>
        <label className="col-span-2 min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.label}</span>
          <input name="label" required maxLength={120} defaultValue={e.label} autoComplete="off" className="field"  enterKeyHint="next" />
        </label>
        {events.length > 0 && (
          <label className="col-span-2 min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.event}</span>
            <select name="client_id" defaultValue={e.client_id ?? ''} className="field">
              <option value="">{c.noEvent}</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </label>
        )}
        <label className="col-span-2 min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.party}</span>
          <input name="party" maxLength={120} defaultValue={e.party} className="field"  autoComplete="off" enterKeyHint="next" />
        </label>
        <label className="col-span-2 min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.note}</span>
          <input name="note" maxLength={500} defaultValue={e.note} className="field"  autoComplete="off" enterKeyHint="done" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Save />
        <button type="button" onClick={onDone} className="btn-quiet px-2 py-1 text-body">{c.editCancel}</button>
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}
