'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Plus, Phone, Pencil } from 'lucide-react';
import { addVehicle, removeVehicle, updateVehicle, type VehicleResult } from '@/app/actions/vehicles';
import type { VehiclesCopy } from '@/content/appUi';
import { Ltr } from '@/components/Ltr';
import { DeleteForm } from '@/components/app/ConfirmDelete';

export type Vehicle = {
  id: string;
  name: string;
  driver: string;
  phone: string;
  seats: number | null;
  riders: string;
  leg: string;
  note: string;
};

/** The cars: how everybody gets from wherever they are getting ready to the
 *  hall, and home. Each one with a name the couple chose, whose it is, a
 *  number to ring, how many seats, and who is riding.
 *
 *  Free text for the riders on purpose. The people in the car on the way to
 *  the hall are not always on the guest list — a stylist, a grandmother's
 *  carer — and a join that cannot name them is a join the couple works
 *  around on paper. */
export function VehiclesPanel({ c, clientId, items }: {
  c: VehiclesCopy; clientId: string; items: Vehicle[];
}) {
  const [state, action, pending] = useActionState<VehicleResult | null, FormData>(addVehicle, null);
  const seats = items.reduce((sum, v) => sum + (v.seats ?? 0), 0);
  const legLabel = (leg: string) => (leg === 'to' ? c.legTo : leg === 'from' ? c.legFrom : c.legBoth);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="head-panel">{c.title}</h2>
          <p className="mt-1 text-body text-ink-soft">{c.sub}</p>
        </div>
        {seats > 0 && (
          <p className="text-body text-ink-mute">
            <span className="font-display text-panel font-semibold text-ink"><Ltr>{seats}</Ltr></span>
            {' '}{c.seatsTotal}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-body text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((v) => (
            <Row key={v.id} c={c} clientId={clientId} v={v} legLabel={legLabel} />
          ))}
        </ul>
      )}

      <form action={action} className="mt-5 border-t border-line pt-4">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
          <label>
            <span className="label">{c.name}</span>
            <input name="name" required maxLength={60} placeholder={c.namePh} className="field mt-1 w-full" />
          </label>
          <label>
            <span className="label">{c.driver}</span>
            <input name="driver" maxLength={80} placeholder={c.driverPh} className="field mt-1 w-full" />
          </label>
          <label>
            <span className="label">{c.phone}</span>
            <input name="phone" type="tel" inputMode="tel" maxLength={30} className="field mt-1 w-full" dir="ltr" />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[110px_160px_1fr]">
          <label>
            <span className="label">{c.seats}</span>
            <input name="seats" type="number" inputMode="numeric" min={1} max={60} className="field mt-1 w-full" />
          </label>
          <label>
            <span className="label">{c.leg}</span>
            <select name="leg" defaultValue="both" className="field mt-1 w-full">
              <option value="both">{c.legBoth}</option>
              <option value="to">{c.legTo}</option>
              <option value="from">{c.legFrom}</option>
            </select>
          </label>
          <label>
            <span className="label">{c.riders}</span>
            <input name="riders" maxLength={400} placeholder={c.ridersPh} className="field mt-1 w-full" />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="label">{c.note}</span>
          <input name="note" maxLength={400} placeholder={c.notePh} className="field mt-1 w-full" />
        </label>
        <Submit c={c} pending={pending} />
        {state?.ok === false && state.error && (
          <p role="status" className="mt-2 text-body text-bad">{state.error}</p>
        )}
      </form>
    </section>
  );
}

function Submit({ c, pending }: { c: VehiclesCopy; pending: boolean }) {
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

/** One car, and the form that corrects it. */
function Row({ c, clientId, v, legLabel }: {
  c: VehiclesCopy; clientId: string; v: Vehicle; legLabel: (leg: string) => string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-card-sm border border-line px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-lead text-ink">
          {v.name}
          {v.driver && <span className="text-ink-soft"> · {v.driver}</span>}
          {v.seats !== null && (
            <span className="ms-2 whitespace-nowrap rounded-control bg-surface-200 px-2 py-0.5 text-micro text-ink-mute">
              <Ltr>{v.seats}</Ltr> {c.seats}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-meta text-ink-mute">
          {legLabel(v.leg)}
          {v.phone && (
            <>
              {' · '}
              <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1 text-ink-soft hover:text-ink">
                <Phone size={11} aria-hidden strokeWidth={1.5} /><Ltr>{v.phone}</Ltr>
              </a>
            </>
          )}
        </p>
        {v.riders && <p className="mt-1 text-body text-ink-soft">{v.riders}</p>}
        {v.note && <p className="mt-0.5 text-meta text-ink-mute">{v.note}</p>}
      </div>

      <button
        type="button"
        onClick={() => setEditing((o) => !o)}
        aria-expanded={editing}
        aria-label={c.edit}
        title={c.edit}
        className="btn-quiet grid size-9 shrink-0 place-items-center px-0 py-0"
      >
        <Pencil size={15} strokeWidth={1.5} aria-hidden />
      </button>

      <DeleteForm action={removeVehicle}>
        <input type="hidden" name="id" value={v.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" className="btn-quiet px-3 py-1 text-body">{c.remove}</button>
      </DeleteForm>

      {editing && <EditVehicle c={c} clientId={clientId} v={v} onDone={() => setEditing(false)} />}
    </li>
  );
}

function SaveEdit({ c }: { c: VehiclesCopy }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? c.editSaving : c.editSave}
    </button>
  );
}

/**
 * Correcting a car in place.
 *
 * Who is driving changes, the phone was typed with a digit missing, and the
 * list of who is riding is rewritten about four times in the last fortnight —
 * that list is free text precisely because it keeps changing in ways no join
 * could follow. Every one of those used to mean deleting the car and typing
 * seven fields again.
 */
function EditVehicle({ c, clientId, v, onDone }: {
  c: VehiclesCopy; clientId: string; v: Vehicle; onDone: () => void;
}) {
  const [state, action] = useActionState<VehicleResult | null, FormData>(
    async (prev, form) => {
      const r = await updateVehicle(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={action} className="mt-3 w-full border-t border-line pt-3">
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="client_id" value={clientId} />

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
        <label>
          <span className="label">{c.name}</span>
          <input name="name" required maxLength={60} defaultValue={v.name} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="label">{c.driver}</span>
          <input name="driver" maxLength={80} defaultValue={v.driver} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="label">{c.phone}</span>
          <input name="phone" type="tel" inputMode="tel" maxLength={30} defaultValue={v.phone} className="field mt-1 w-full" dir="ltr" />
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[110px_160px_1fr]">
        <label>
          <span className="label">{c.seats}</span>
          <input name="seats" type="number" inputMode="numeric" min={1} max={60} defaultValue={v.seats ?? ''} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="label">{c.leg}</span>
          <select name="leg" defaultValue={v.leg} className="field mt-1 w-full">
            <option value="both">{c.legBoth}</option>
            <option value="to">{c.legTo}</option>
            <option value="from">{c.legFrom}</option>
          </select>
        </label>
        <label>
          <span className="label">{c.riders}</span>
          <input name="riders" maxLength={400} defaultValue={v.riders} className="field mt-1 w-full" />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="label">{c.note}</span>
        <input name="note" maxLength={400} defaultValue={v.note} className="field mt-1 w-full" />
      </label>

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
