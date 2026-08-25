'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { addCrew, updateCrew, removeCrew, type CrewResult } from '@/app/actions/crew';
import { CREW_ROLES } from '@/content/production';
import { crewCopy as c } from '@/content/site';
import { hhmm, inDayOrder } from '@/lib/runsheet';
import { Money } from '@/components/Ltr';

export type CrewMember = {
  id: string; name: string; role: string; phone: string;
  call_time: string | null; fee: number | null; notes: string;
};


function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
      {text}
    </p>
  );
}

function Fields({ member }: { member?: CrewMember }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
        <div>
          <label className="label">{c.name}</label>
          <input name="name" required defaultValue={member?.name} autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label">{c.role}</label>
          {/* A list of the jobs that come up on almost every evening, with the
              field still free: the twelfth role is always something nobody
              listed, and a closed list would send it to a notes box. */}
          <input
            name="role" defaultValue={member?.role} list="crew-roles"
            placeholder={c.rolePh} autoComplete="off" className="field"
          />
          <datalist id="crew-roles">
            {CREW_ROLES.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>
        <div>
          <label className="label">{c.callTime}</label>
          <input name="call_time" type="time" defaultValue={member?.call_time ? hhmm(member.call_time) : ''} className="field" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_1fr]">
        <div>
          <label className="label">{c.phone}</label>
          <input name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={member?.phone} autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label">{c.fee}</label>
          <input
            name="fee" type="number" min={0} step="10" inputMode="decimal"
            defaultValue={member?.fee ?? ''} placeholder={c.feePh} className="field"
          />
        </div>
        <div>
          <label className="label">{c.notes}</label>
          <input name="notes" defaultValue={member?.notes} autoComplete="off" className="field" />
        </div>
      </div>
    </>
  );
}

function Row({ member, clientId }: { member: CrewMember; clientId: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<CrewResult | null, FormData>(
    async (prev, form) => {
      const r = await updateCrew(prev, form);
      if (r.ok) setEditing(false);
      return r;
    },
    null
  );

  if (editing) {
    return (
      <li className="rounded-xl2 border border-accent/40 bg-surface-100 p-4">
        <form action={action} noValidate>
          <input type="hidden" name="crew_id" value={member.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <Fields member={member} />
          {state && !state.ok && state.error && <Alert text={state.error} />}
          <div className="mt-4 flex flex-wrap gap-3">
            <Save />
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>{c.cancel}</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex gap-4 rounded-xl2 border border-line px-4 py-3.5 transition hover:border-line-strong">
      <div className="w-[58px] shrink-0 text-center" dir="ltr">
        <span className={`font-display text-[16px] font-light tabular-nums ${member.call_time ? 'text-ink' : 'text-ink-mute'}`}>
          {member.call_time ? hhmm(member.call_time) : '·'}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] text-ink">
          {member.name}
          {member.role && <span className="text-ink-mute"> · {member.role}</span>}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-mute">
          {member.phone && <a href={`tel:${member.phone}`} dir="ltr" className="hover:text-accent">{member.phone}</a>}
          {member.fee !== null && <Money value={member.fee} className="tabular-nums" />}
        </div>
        {member.notes && <p className="mt-0.5 text-[13px] text-ink-soft">{member.notes}</p>}
      </div>

      <div className="flex shrink-0 items-start gap-1">
        <button
          type="button" onClick={() => setEditing(true)} title={c.edit}
          aria-label={`${c.edit} ${member.name}`}
          className="rounded-xl2 p-1.5 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
        >
          <Pencil size={15} aria-hidden strokeWidth={1.5} />
        </button>
        <form action={removeCrew}>
          <input type="hidden" name="crew_id" value={member.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <button
            type="submit" title={c.remove} aria-label={`${c.remove} ${member.name}`}
            className="rounded-xl2 p-1.5 text-ink-mute transition hover:bg-bad-wash hover:text-bad"
          >
            <Trash2 size={15} aria-hidden strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Who is working the evening.
 *
 * Ordered by call time rather than by name, because the question this panel
 * answers on the day is who is arriving next. It borrows the run sheet's
 * ordering so a crew call at 01:00 after a midnight finish sorts as the end of
 * the night rather than the start of the morning.
 *
 * Producer-only, and the panel says so out loud. A screen carrying what people
 * are paid should be unambiguous about who can see it, so that nobody has to
 * remember the policy to trust the screen.
 */
export function CrewPanel({ clientId, crew }: { clientId: string; crew: CrewMember[] }) {
  const [adding, setAdding] = useState(false);
  const [state, action] = useActionState<CrewResult | null, FormData>(
    async (prev, form) => {
      const r = await addCrew(prev, form);
      if (r.ok) setAdding(false);
      return r;
    },
    null
  );

  /* Anybody without a call time goes last: they are on the event, they are not
     part of the arrival order. */
  const timed = inDayOrder(crew.filter((m) => m.call_time).map((m) => ({ ...m, at_time: m.call_time! })));
  const untimed = crew.filter((m) => !m.call_time);
  const ordered = [...timed, ...untimed];

  const total = crew.reduce((sum, m) => sum + (m.fee ?? 0), 0);

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-light text-ink">
            <Users size={18} aria-hidden strokeWidth={1.5} />
            {c.title}
          </h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl2 border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
        >
          <Plus size={15} aria-hidden strokeWidth={1.5} />
          {adding ? c.close : c.add}
        </button>
      </div>

      {adding && (
        <form action={action} className="mt-4 rounded-xl2 border border-line bg-surface-100 p-4" noValidate>
          <input type="hidden" name="client_id" value={clientId} />
          <Fields />
          {state && !state.ok && state.error && <Alert text={state.error} />}
          <div className="mt-4"><Save /></div>
        </form>
      )}

      {ordered.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
            {ordered.map((m) => <Row key={m.id} member={m} clientId={clientId} />)}
          </ul>
          {total > 0 && (
            <p className="mt-4 text-left text-[14px] text-ink-soft">
              {c.totalFee} <b className="tabular-nums text-ink"><Money value={total} /></b>
            </p>
          )}
        </>
      )}

      <p className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
        <Lock size={13} aria-hidden strokeWidth={1.5} />
        {c.privateNote}
      </p>
    </section>
  );
}
