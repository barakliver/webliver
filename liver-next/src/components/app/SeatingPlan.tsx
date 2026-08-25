'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addTable, setTableSeats, deleteTable, seatGuest, type SeatResult } from '@/app/actions/seating';
import { seatingCopy } from '@/content/site';

export type SeatTable = { id: string; name: string; seats: number };
export type SeatGuest = {
  id: string; full_name: string; party_size: number;
  status: 'pending' | 'attending' | 'declined'; table_id: string | null;
};

function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>{pending ? busy : label}</button>;
}

function Err({ state }: { state: SeatResult | null }) {
  if (!state || state.ok || !state.error) return null;
  return (
    <p role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-800">
      {state.error}
    </p>
  );
}

export function SeatingPlan({ clientId, tables, guests }: {
  clientId: string; tables: SeatTable[]; guests: SeatGuest[];
}) {
  const [addState, addAction] = useActionState<SeatResult | null, FormData>(addTable, null);
  const [seatState, seatAction] = useActionState<SeatResult | null, FormData>(seatGuest, null);
  const [sizeState, sizeAction] = useActionState<SeatResult | null, FormData>(setTableSeats, null);
  const c = seatingCopy;

  /* only people who said yes take a chair, which is the same rule the
     database enforces, so the screen never offers a move that gets refused */
  const attending = guests.filter((g) => g.status === 'attending');
  const waiting = attending.filter((g) => !g.table_id);
  const atTable = (id: string) => attending.filter((g) => g.table_id === id);
  const takenAt = (id: string) => atTable(id).reduce((a, g) => a + Number(g.party_size || 0), 0);

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">🪑 {c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

      <form action={addAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <input type="hidden" name="client_id" value={clientId} />
        <input name="name" required placeholder={c.tableNamePh} autoComplete="off" className="field" aria-label={c.tableName} />
        <input name="seats" type="number" min={1} max={40} defaultValue={12} className="field" aria-label={c.seats} />
        <Busy label={c.add} busy={c.adding} />
      </form>
      <Err state={addState} />
      <Err state={seatState} />
      <Err state={sizeState} />

      {attending.length === 0 && <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900">{c.needRsvp}</p>}

      <div className="mt-6 rounded-2xl border border-line p-4">
        <h3 className="text-[13px] font-semibold text-bronze">
          {c.unseated} · {waiting.reduce((a, g) => a + Number(g.party_size || 0), 0)} {c.peopleShort}
        </h3>
        {waiting.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-mute">{attending.length ? c.unseatedNone : '—'}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {waiting.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-ivory-100 px-3 py-2">
                <span className="flex-1 text-[14.5px] text-ink">
                  {g.full_name} <span className="text-ink-mute">· {g.party_size}</span>
                </span>
                <form action={seatAction} className="flex gap-2">
                  <input type="hidden" name="guest_id" value={g.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <select name="table_id" required defaultValue="" className="field w-[150px] py-1.5 text-[13.5px]" aria-label={c.place}>
                    <option value="" disabled>{c.choose}</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.seats - takenAt(t.id)} {c.free}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-ghost px-3 py-1.5 text-[13px]">{c.place}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {tables.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.noTables}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => {
            const taken = takenAt(t.id);
            const free = t.seats - taken;
            return (
              <li key={t.id} className={`rounded-2xl border p-4 ${free === 0 ? 'border-emerald-300 bg-emerald-50/40' : 'border-line'}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-[16px] font-semibold text-ink">{t.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${
                    free === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-ivory-200 text-ink-mute'
                  }`}>
                    {taken}/{t.seats} {free === 0 ? c.full : ''}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory-200">
                  <div className="h-full rounded-full bg-bronze transition-[width]" style={{ width: `${Math.min(100, (taken / t.seats) * 100)}%` }} />
                </div>

                {atTable(t.id).length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-ink-mute">{c.emptyTable}</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {atTable(t.id).map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 text-[14px]">
                        <span className="text-ink">{g.full_name} <span className="text-ink-mute">· {g.party_size}</span></span>
                        <form action={seatAction}>
                          <input type="hidden" name="guest_id" value={g.id} />
                          <input type="hidden" name="client_id" value={clientId} />
                          <input type="hidden" name="table_id" value="" />
                          <button type="submit" className="btn-quiet px-2 py-0.5 text-[12.5px]" title={c.unseat}>✕</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <form action={sizeAction} className="flex gap-2">
                    <input type="hidden" name="table_id" value={t.id} />
                    <input type="hidden" name="client_id" value={clientId} />
                    <input
                      name="seats" type="number" min={1} max={40} defaultValue={t.seats}
                      className="field w-[80px] py-1 text-[13px]" aria-label={c.seats}
                    />
                    <button type="submit" className="btn-quiet px-2 py-1 text-[12.5px]">{c.seats}</button>
                  </form>
                  <form action={deleteTable}>
                    <input type="hidden" name="table_id" value={t.id} />
                    <input type="hidden" name="client_id" value={clientId} />
                    <button type="submit" className="btn-quiet px-2 py-1 text-[12.5px]" title={c.removeTableHint}>
                      {c.removeTable}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
