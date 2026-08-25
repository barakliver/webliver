'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addTable, setTableSeats, deleteTable, seatGuest, type SeatResult } from '@/app/actions/seating';
import { seatingCopy } from '@/content/site';
import { Ratio } from '@/components/Ltr';

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
    <p role="alert" className="mt-3 rounded-none border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
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

  /* Dragging is an addition, never the only way. It does not exist for a
     keyboard, a screen reader, or most touch browsers — HTML5 drag events
     simply do not fire there — so every seat and unseat below still has its
     own control. What follows makes the mouse path quicker, and nothing
     depends on it. */
  const [dragging, setDragging] = useState<SeatGuest | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const move = (guest: SeatGuest, tableId: string | null) => {
    if ((guest.table_id ?? '') === (tableId ?? '')) return;
    const fd = new FormData();
    fd.set('guest_id', guest.id);
    fd.set('client_id', clientId);
    fd.set('table_id', tableId ?? '');
    seatAction(fd);
  };

  /* A table that cannot hold the party refuses the drop rather than accepting
     it and letting the database bounce it back — the answer is the same, but
     the cursor says so before the release instead of an error afterwards. */
  const fits = (guest: SeatGuest, table: SeatTable) =>
    takenAt(table.id) + Number(guest.party_size || 0) <= table.seats;

  const dragProps = (g: SeatGuest) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(g);
      e.dataTransfer.effectAllowed = 'move';
      /* Some browsers cancel a drag that carries no data at all. */
      e.dataTransfer.setData('text/plain', g.id);
    },
    onDragEnd: () => { setDragging(null); setOver(null); },
  });

  const dropProps = (tableId: string | null, allowed: boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragging || !allowed) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOver(tableId ?? 'unseated');
    },
    onDragLeave: () => setOver((v) => (v === (tableId ?? 'unseated') ? null : v)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging && allowed) move(dragging, tableId);
      setDragging(null);
      setOver(null);
    },
  });

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-light text-ink">🪑 {c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
      <p className="mt-1 hidden text-[13px] text-ink-mute sm:block">{c.dragHint}</p>

      <form action={addAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <input type="hidden" name="client_id" value={clientId} />
        <input name="name" required placeholder={c.tableNamePh} autoComplete="off" className="field" aria-label={c.tableName} />
        <input name="seats" type="number" min={1} max={40} defaultValue={12} className="field" aria-label={c.seats} />
        <Busy label={c.add} busy={c.adding} />
      </form>
      <Err state={addState} />
      <Err state={seatState} />
      <Err state={sizeState} />

      {attending.length === 0 && <p className="mt-5 rounded-none bg-warn-wash px-4 py-3 text-[14px] text-warn">{c.needRsvp}</p>}

      <div
        {...dropProps(null, !!dragging && !!dragging.table_id)}
        className={`mt-6 rounded-none border p-4 transition-colors ${
          over === 'unseated' ? 'border-accent bg-accent-wash' : 'border-line'
        }`}
      >
        <h3 className="text-[13px] font-semibold text-accent">
          {c.unseated} · {waiting.reduce((a, g) => a + Number(g.party_size || 0), 0)} {c.peopleShort}
        </h3>
        {waiting.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-mute">{attending.length ? c.unseatedNone : '·'}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {waiting.map((g) => (
              <li
                key={g.id}
                {...dragProps(g)}
                className="flex flex-wrap items-center gap-3 rounded-none bg-surface-100 px-3 py-2 sm:cursor-grab sm:active:cursor-grabbing"
              >
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
              <li
                key={t.id}
                {...dropProps(t.id, !!dragging && fits(dragging, t))}
                className={`rounded-none border p-4 transition-colors ${
                  over === t.id ? 'border-accent bg-accent-wash'
                  : dragging && !fits(dragging, t) ? 'border-line opacity-50'
                  : free === 0 ? 'border-ok/30 bg-ok-wash/60'
                  : 'border-line'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-[16px] font-light text-ink">{t.name}</h3>
                  <span className={`rounded-none px-2.5 py-0.5 text-[12px] ${
                    free === 0 ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
                  }`}>
                    <Ratio of={taken} total={t.seats} /> {free === 0 ? c.full : ''}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200">
                  <div className="h-full rounded-none bg-accent transition-[width]" style={{ width: `${Math.min(100, (taken / t.seats) * 100)}%` }} />
                </div>

                {atTable(t.id).length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-ink-mute">{c.emptyTable}</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {atTable(t.id).map((g) => (
                      <li
                        key={g.id}
                        {...dragProps(g)}
                        className="flex items-center justify-between gap-2 rounded-none text-[14px] sm:cursor-grab sm:active:cursor-grabbing"
                      >
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
