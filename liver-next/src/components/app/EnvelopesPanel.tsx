'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Plus, Check } from 'lucide-react';
import { addEnvelope, removeEnvelope, toggleDelivered, type EnvelopeResult } from '@/app/actions/envelopes';
import type { EnvelopesCopy } from '@/content/appUi';
import { Money } from '@/components/Ltr';

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
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        {items.length > 0 && (
          <p className="text-[13.5px] text-ink-mute">
            <span className="font-display text-[20px] font-semibold text-ink"><Money value={total} /></span>
            {' · '}{c.handed.replace('{n}', String(handed)).replace('{of}', String(items.length))}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((e) => (
            <li
              key={e.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl2 border px-3 py-3 ${
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
                <p className={`text-[15px] ${e.delivered_at ? 'text-ink-mute' : 'text-ink'}`}>
                  {e.label}
                  {e.recipient && <span className="text-ink-soft"> · {e.recipient}</span>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-mute">
                  {e.cash ? c.cash : c.transfer}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>

              <span className="font-display text-[17px] font-semibold tabular-nums text-ink">
                {e.amount === null ? '·' : <Money value={e.amount} />}
              </span>

              <form action={removeEnvelope}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.remove}</button>
              </form>
            </li>
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
            <input name="amount" type="number" inputMode="decimal" min={0} className="field mt-1 w-full" />
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
          <p role="status" className="mt-2 text-[13.5px] text-bad">{state.error}</p>
        )}
      </form>
    </section>
  );
}

function Submit({ c, pending }: { c: EnvelopesCopy; pending: boolean }) {
  const { pending: busy } = useFormStatus();
  const wait = pending || busy;
  return (
    <button type="submit" disabled={wait} className="btn-primary mt-3 px-4 text-[14px]">
      {wait
        ? <Loader2 size={15} strokeWidth={1.5} aria-hidden className="animate-spin" />
        : <Plus size={15} strokeWidth={1.5} aria-hidden />}
      {wait ? c.adding : c.add}
    </button>
  );
}
