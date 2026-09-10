'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Check } from 'lucide-react';
import { Sheet } from '@/components/app/Sheet';
import { useCopy } from '@/components/app/CopyProvider';
import { addLedgerEntry, type LedgerResult } from '@/app/actions/ledger';
import { todayInZone } from '@/lib/clock';
import type { JumpEvent } from '@/components/app/QuickJump';

function Save() {
  const c = useCopy().quickLedger;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

/**
 * The plus in the header.
 *
 * A tip on the night, a deposit from a couple whose file is not open yet, a
 * parking receipt: money that happens between screens and used to go into
 * a note to self. One sheet, five fields, and the event is optional on
 * purpose, because the thing most often recorded here is the one with no
 * file to attach it to. The sheet says, in its own words, that it records
 * and does not invoice.
 */
export function QuickLedger({ events, compact = false }: { events: JumpEvent[]; compact?: boolean }) {
  const c = useCopy().quickLedger;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'income' | 'expense'>('income');
  const [state, action] = useActionState<LedgerResult | null, FormData>(addLedgerEntry, null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      setSaved(true);
      const t = setTimeout(() => { setSaved(false); setOpen(false); }, 900);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={c.open}
        title={c.open}
        className={`grid place-items-center rounded-full border border-line-strong bg-card text-ink transition hover:border-accent hover:text-accent ${compact ? 'size-9' : 'size-9'}`}
      >
        <Plus size={17} strokeWidth={1.75} aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={c.title} sub={c.sub}>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="kind" value={kind} />
          <div className="inline-flex rounded-xl2 border border-line bg-surface-100 p-1 text-[14px]" role="radiogroup" aria-label={c.title}>
            {(['income', 'expense'] as const).map((k) => (
              <button
                key={k} type="button" role="radio" aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-[40px] flex-1 rounded-xl2 px-4 transition ${kind === k ? (k === 'income' ? 'bg-ok-wash font-medium text-ok' : 'bg-bad-wash font-medium text-bad') : 'text-ink-mute'}`}
              >
                {k === 'income' ? c.income : c.expense}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12.5px] text-ink-mute">
              {c.amount}
              <input name="amount" type="number" inputMode="decimal" min={0} step="1" required autoFocus className="field mt-1 w-full" />
            </label>
            <label className="text-[12.5px] text-ink-mute">
              {c.date}
              <input name="on_date" type="date" defaultValue={todayInZone()} className="field mt-1 w-full" />
            </label>
          </div>
          <label className="text-[12.5px] text-ink-mute">
            {c.label}
            <input name="label" required maxLength={120} placeholder={c.labelPh} className="field mt-1 w-full" />
          </label>
          <label className="text-[12.5px] text-ink-mute">
            {c.event}
            <select name="client_id" defaultValue="" className="field mt-1 w-full">
              <option value="">{c.noEvent}</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="text-[12.5px] text-ink-mute">
            {c.party}
            <input name="party" maxLength={120} placeholder={c.partyPh} className="field mt-1 w-full" />
          </label>
          <label className="text-[12.5px] text-ink-mute">
            {c.note}
            <input name="note" maxLength={500} className="field mt-1 w-full" />
          </label>

          {state && !state.ok && (
            <p role="alert" className="rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{state.error ?? c.failed}</p>
          )}
          {saved && (
            <p role="status" className="inline-flex items-center gap-2 text-[14px] text-ok"><Check size={15} aria-hidden strokeWidth={1.5} />{c.saved}</p>
          )}
          <div className="mt-1"><Save /></div>
        </form>
      </Sheet>
    </>
  );
}
