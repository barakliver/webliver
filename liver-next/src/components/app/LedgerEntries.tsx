'use client';

import { useCopy } from '@/components/app/CopyProvider';
import { Money } from '@/components/Ltr';
import { shortDate } from '@/lib/appDates';
import { removeLedgerEntry } from '@/app/actions/ledger';

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

/** What the plus recorded, with three totals. On the event's money tab it
 *  is that event's entries; on insights it is everything, newest first. */
export function LedgerEntries({ entries, showEvent = true }: { entries: LedgerEntry[]; showEvent?: boolean }) {
  const ui = useCopy();
  const c = ui.quickLedger;
  const dateFmt = shortDate(ui.locale);
  const income = entries.filter((e) => e.kind === 'income').reduce((a, e) => a + e.amount, 0);
  const expense = entries.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0);

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.listTitle}</h2>
      <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.listSub}</p>

      {entries.length === 0 ? (
        <p className="mt-5 text-[14.5px] text-ink-mute">{c.listNone}</p>
      ) : (
        <>
          <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-3">
            <div><p className="eyebrow">{c.totalIn}</p><p className="mt-1 font-display text-[22px] font-semibold text-ok"><Money value={income} /></p></div>
            <div><p className="eyebrow">{c.totalOut}</p><p className="mt-1 font-display text-[22px] font-semibold text-bad"><Money value={expense} /></p></div>
            <div><p className="eyebrow">{c.net}</p><p className={`mt-1 font-display text-[22px] font-semibold ${income - expense < 0 ? 'text-bad' : 'text-ink'}`}><Money value={income - expense} /></p></div>
          </div>
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-[14px]">
                <span className="w-[76px] shrink-0 tabular-nums text-ink-mute">{dateFmt.format(new Date(`${e.on_date}T12:00:00Z`))}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{e.label}</span>
                  <span className="block text-[12.5px] text-ink-mute">
                    {showEvent ? (e.event_name ?? e.party ?? c.unattached) : e.party}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 tabular-nums font-medium ${e.kind === 'income' ? 'text-ok' : 'text-bad'}`}>
                  {e.kind === 'expense' ? '-' : ''}<Money value={e.amount} />
                </span>
                <form action={removeLedgerEntry}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="client_id" value={e.client_id ?? ''} />
                  <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
