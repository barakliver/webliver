'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createClient, type ActionResult } from '@/app/actions/clients';
import { appCopy, EVENT_KINDS, MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? appCopy.newClient.saving : appCopy.newClient.submit}
    </button>
  );
}

export function NewClientForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(createClient, null);
  const c = appCopy.newClient;

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {c.open}
      </button>
    );
  }

  return (
    <form action={action} className="card space-y-5" noValidate>
      <div>
        <h2 className="font-display text-[19px] font-light text-ink">{c.title}</h2>
        <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-3 text-[14.5px] text-bad">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nc-name">{c.name}</label>
          <input id="nc-name" name="display_name" required className="field" placeholder={c.namePh} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="nc-kind">{c.kind}</label>
          <select id="nc-kind" name="kind" className="field" defaultValue="wedding">
            {EVENT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="nc-date">{c.date}</label>
          <input id="nc-date" name="event_date" type="date" min={MIN_EVENT_DATE} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="nc-venue">{c.venue}</label>
          <input id="nc-venue" name="venue" className="field" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="nc-guests">{c.guests}</label>
          <input id="nc-guests" name="guest_estimate" type="number" min={1} max={MAX_GUESTS} inputMode="numeric" className="field" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Submit />
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{c.cancel}</button>
      </div>
    </form>
  );
}
