'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Plus, Phone } from 'lucide-react';
import { addVehicle, removeVehicle, type VehicleResult } from '@/app/actions/vehicles';
import type { VehiclesCopy } from '@/content/appUi';
import { Ltr } from '@/components/Ltr';

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
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        {seats > 0 && (
          <p className="text-[13.5px] text-ink-mute">
            <span className="font-display text-[20px] font-semibold text-ink"><Ltr>{seats}</Ltr></span>
            {' '}{c.seatsTotal}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((v) => (
            <li key={v.id} className="flex flex-wrap items-start gap-3 rounded-xl2 border border-line px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink">
                  {v.name}
                  {v.driver && <span className="text-ink-soft"> · {v.driver}</span>}
                  {v.seats !== null && (
                    <span className="ms-2 rounded-xl2 bg-surface-200 px-2 py-0.5 text-[11.5px] text-ink-mute">
                      <Ltr>{v.seats}</Ltr> {c.seats}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-mute">
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
                {v.riders && <p className="mt-1 text-[13.5px] text-ink-soft">{v.riders}</p>}
                {v.note && <p className="mt-0.5 text-[12.5px] text-ink-mute">{v.note}</p>}
              </div>
              <form action={removeVehicle}>
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.remove}</button>
              </form>
            </li>
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
          <p role="status" className="mt-2 text-[13.5px] text-bad">{state.error}</p>
        )}
      </form>
    </section>
  );
}

function Submit({ c, pending }: { c: VehiclesCopy; pending: boolean }) {
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
