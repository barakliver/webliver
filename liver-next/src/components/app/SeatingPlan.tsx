'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addTable, setTableSeats, deleteTable, seatGuest, type SeatResult } from '@/app/actions/seating';
import { useCopy } from '@/components/app/CopyProvider';
import { Ratio } from '@/components/Ltr';
import { useDragOnto, Grip, Carried } from '@/components/app/DragOnto';

export type SeatTable = { id: string; name: string; seats: number };
export type SeatGuest = {
  id: string; full_name: string; party_size: number;
  status: 'pending' | 'attending' | 'declined'; table_id: string | null;
};

/* The waiting list is a drop zone like any table, and it needs an id that
   cannot collide with one. */
const UNSEATED = 'unseated';

function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>{pending ? busy : label}</button>;
}

function Err({ state }: { state: SeatResult | null }) {
  if (!state || state.ok || !state.error) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
      {state.error}
    </p>
  );
}

/**
 * The room, drawn.
 *
 * A seating plan that is a list of boxes answers "how many are at table four".
 * The question a producer actually has, standing in a venue with a diagram in
 * their hand, is "does this look right" — which tables are heavy, which are
 * nearly empty, whether the room balances. That is a shape question, and a
 * list cannot answer a shape question however accurate it is.
 *
 * So each table is a table: a circle sized by how many it seats, with one
 * chair drawn per seat around its rim. A taken chair is filled, a free one is
 * an outline, and a full table closes its ring. Nothing here is a new source
 * of truth — every chair is read from the same seating the list below shows —
 * and nothing here is the only way to do anything, because a circle of dots is
 * not operable by a keyboard or announced usefully by a screen reader. The
 * chairs are `aria-hidden` for exactly that reason: the authoritative version
 * of who sits where is the text underneath, and reading the room twice is
 * worse than reading it once.
 */
function Chair({ i, of, taken, name }: { i: number; of: number; taken: boolean; name?: string }) {
  /* Seat one at the top, then clockwise. -90° because CSS angles start east
     and a table whose first chair is on the right reads as rotated. */
  const angle = (i / of) * 2 * Math.PI - Math.PI / 2;
  const r = 44;  /* percent of the circle's own box, so it scales with it */
  return (
    <span
      aria-hidden
      title={name}
      className={`absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors ${
        taken ? 'border-accent bg-accent' : 'border-line-control bg-transparent'
      }`}
      style={{
        left: `${50 + r * Math.cos(angle)}%`,
        top: `${50 + r * Math.sin(angle)}%`,
      }}
    />
  );
}

function Table({ table, seated, taken, dim, active, onOpen, drop }: {
  table: SeatTable;
  seated: SeatGuest[];
  taken: number;
  /** a drag is in flight that this table cannot hold */
  dim: boolean;
  /** the drag is currently over this table */
  active: boolean;
  onOpen: () => void;
  drop: Record<string, unknown>;
}) {
  const c = useCopy().seating;
  const full = taken >= table.seats;

  /* One chair per seat, and a party of four fills four of them. Which chair a
     particular guest is in is not recorded anywhere and is not invented here:
     the chairs are filled in the order the guests were seated. */
  const occupant: (string | undefined)[] = [];
  for (const g of seated) {
    for (let n = 0; n < Math.max(1, Number(g.party_size || 1)); n += 1) {
      if (occupant.length < table.seats) occupant.push(g.full_name);
    }
  }

  /* 8 seats is a small round table and 12 a large one; the drawing keeps that
     difference rather than making every table the same size, because the
     relative weight of the tables is half of what this view is for. */
  const size = Math.round(Math.min(200, Math.max(128, 104 + table.seats * 7)));

  return (
    <div
      {...drop}
      className={`flex flex-col items-center gap-2 transition-opacity ${dim ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        onClick={onOpen}
        /* Spoken, not shown, so it says the numbers in words rather than as
           a ratio: "8/12" through a screen reader in a Hebrew page is read in
           pieces and in the wrong order. The ratio stays on screen, isolated,
           where <Ratio> handles it. */
        aria-label={`${table.name} · ${taken} ${c.peopleShort} · ${c.openTable}`}
        className={`relative grid shrink-0 place-items-center rounded-full border transition-colors
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                    focus-visible:outline-accent ${
          active ? 'border-accent bg-accent-wash'
          : full ? 'border-ok/50 bg-ok-wash/50'
          : 'border-line-strong bg-surface-100 hover:border-accent'
        }`}
        style={{ width: size, height: size }}
      >
        {Array.from({ length: table.seats }, (_, i) => (
          <Chair key={i} i={i} of={table.seats} taken={i < taken} name={occupant[i] ?? c.seatFree} />
        ))}
        <span className="pointer-events-none flex flex-col items-center gap-0.5 px-4 text-center">
          <span className="font-display text-[15px] font-semibold leading-tight text-ink">{table.name}</span>
          <span className="text-[12.5px] tabular-nums text-ink-mute">
            <Ratio of={taken} total={table.seats} />
          </span>
          {full && <span className="text-[11.5px] text-ok">{c.full}</span>}
        </span>
      </button>
    </div>
  );
}

export function SeatingPlan({ clientId, tables, guests }: {
  clientId: string; tables: SeatTable[]; guests: SeatGuest[];
}) {
  const [addState, addAction] = useActionState<SeatResult | null, FormData>(addTable, null);
  const [seatState, seatAction] = useActionState<SeatResult | null, FormData>(seatGuest, null);
  const [sizeState, sizeAction] = useActionState<SeatResult | null, FormData>(setTableSeats, null);
  const c = useCopy().seating;

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

  /* This used to be the HTML drag and drop API, which meant the seating plan
     — the one screen here that is genuinely a diagram somebody moves things
     around on — did nothing whatsoever on a phone. `dragstart` does not exist
     on a touch screen. Standing in a venue with a tablet is precisely when
     somebody moves a family from table four to table six. */
  const drag = useDragOnto<SeatGuest>({
    canDrop: (g, zone) => {
      if (zone === UNSEATED) return !!g.table_id;
      const t = tables.find((x) => x.id === zone);
      return !!t && (g.table_id === t.id || fits(g, t));
    },
    onDrop: (g, zone) => move(g, zone === UNSEATED ? null : zone),
  });

  const dragging = drag.item;
  const over = drag.over;

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">🪑 {c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
      <p className="mt-1 text-[13px] text-ink-mute">{c.dragHint}</p>

      <form action={addAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <input type="hidden" name="client_id" value={clientId} />
        <input name="name" required placeholder={c.tableNamePh} autoComplete="off" className="field" aria-label={c.tableName} />
        <input name="seats" type="number" min={1} max={40} defaultValue={12} className="field" aria-label={c.seats} />
        <Busy label={c.add} busy={c.adding} />
      </form>
      <Err state={addState} />
      <Err state={seatState} />
      <Err state={sizeState} />

      {attending.length === 0 && <p className="mt-5 rounded-xl2 bg-warn-wash px-4 py-3 text-[14px] text-warn">{c.needRsvp}</p>}

      <div
        {...drag.zone(UNSEATED)}
        className={`mt-6 rounded-xl2 border p-4 transition-colors ${
          over === UNSEATED ? 'border-accent bg-accent-wash' : 'border-line'
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
                {...drag.row(g)}
                className={`flex flex-wrap items-center gap-2 rounded-xl2 bg-surface-100 px-3 py-2 transition ${
                  dragging?.id === g.id ? 'opacity-40' : ''
                }`}
              >
                <Grip label={c.dragHint} {...drag.grip(g)} />
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

      {tables.length > 0 && (
        <div className="mt-8">
          <h3 className="eyebrow">{c.floor}</h3>
          <p className="mt-1.5 text-[13px] text-ink-mute">{c.floorSub}</p>
          {/* Wrapped rather than laid out on a grid: a room is not a table of
              cells, and letting the circles find their own rows is closer to
              how they sit in one. Horizontal overflow is impossible here, so
              nothing scrolls sideways on a phone. */}
          <div className="mt-5 flex flex-wrap items-start justify-center gap-x-8 gap-y-7">
            {tables.map((t) => (
              <Table
                key={t.id}
                table={t}
                seated={atTable(t.id)}
                taken={takenAt(t.id)}
                dim={!!dragging && !fits(dragging, t)}
                active={over === t.id}
                onOpen={() => {
                  document.getElementById(`table-${t.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                drop={drag.zone(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {tables.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.noTables}</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => {
            const taken = takenAt(t.id);
            const free = t.seats - taken;
            return (
              <li
                key={t.id}
                id={`table-${t.id}`}
                {...drag.zone(t.id)}
                className={`scroll-mt-24 rounded-4xl border p-4 transition-colors ${
                  over === t.id ? 'border-accent bg-accent-wash'
                  : dragging && !fits(dragging, t) ? 'border-line opacity-50'
                  : free === 0 ? 'border-ok/30 bg-ok-wash/60'
                  : 'border-line'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-[16px] font-semibold text-ink">{t.name}</h3>
                  <span className={`rounded-xl2 px-2.5 py-0.5 text-[12px] ${
                    free === 0 ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
                  }`}>
                    <Ratio of={taken} total={t.seats} /> {free === 0 ? c.full : ''}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200">
                  <div className="h-full rounded-xl2 bg-accent transition-[width]" style={{ width: `${Math.min(100, (taken / t.seats) * 100)}%` }} />
                </div>

                {atTable(t.id).length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-ink-mute">{c.emptyTable}</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {atTable(t.id).map((g) => (
                      <li
                        key={g.id}
                        {...drag.row(g)}
                        className={`flex items-center justify-between gap-1 rounded-xl2 text-[14px] transition ${
                          dragging?.id === g.id ? 'opacity-40' : ''
                        }`}
                      >
                        <Grip label={c.dragHint} {...drag.grip(g)} />
                        <span className="flex-1 text-ink">{g.full_name} <span className="text-ink-mute">· {g.party_size}</span></span>
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
      <Carried at={drag.at}>
        {dragging?.full_name}
      </Carried>
    </section>
  );
}
