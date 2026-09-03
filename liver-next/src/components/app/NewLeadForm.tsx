'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { recordLead, type LeadActionResult } from '@/app/actions/leads';
import { leadsCopy as c, LEAD_SOURCES, EVENT_KINDS, MIN_EVENT_DATE, MAX_GUESTS, REGIONS } from '@/content/site';
import { RegionPicker } from '@/components/RegionPicker';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.addSaving : c.addSave}
    </button>
  );
}

/**
 * An enquiry that arrived by phone, by message, or through a friend.
 *
 * Most of this business's work comes from somebody who called. Until now the
 * leads screen only knew about the ones that came through the website form,
 * which meant the funnel it reports on was measuring the smaller half and
 * every real conversation lived in a notebook.
 *
 * Only a name and one way to answer are required. Whoever is filling this in
 * is often still on the phone, and a form that insists on a date and a guest
 * count from somebody who has neither yet is a form that gets abandoned.
 */
export function NewLeadForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LeadActionResult | null, FormData>(recordLead, null);

  /* Closing on success rather than leaving the filled in form on screen: it
     is otherwise impossible to tell whether the save happened, and the second
     press files the same person twice. */
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  if (!open) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        + {c.add}
      </button>
    );
  }

  return (
    <form action={action} className="card mt-4 space-y-5" noValidate>
      <div>
        <h2 className="font-display text-[19px] font-semibold text-ink">{c.addTitle}</h2>
        <p className="mt-1 text-[14px] text-ink-soft">{c.addSub}</p>
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-3 text-[14.5px] text-bad">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="nl-name">{c.addName}</label>
          <input id="nl-name" name="full_name" required autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="nl-phone">{c.addPhone}</label>
          <input id="nl-phone" name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="nl-email">{c.addEmail}</label>
          <input id="nl-email" name="email" type="email" dir="ltr" autoComplete="off" className="field" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="nl-kind">{c.addKind}</label>
          <select id="nl-kind" name="kind" defaultValue="wedding" className="field">
            {EVENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="nl-date">{c.addDate}</label>
          <input id="nl-date" name="event_date" type="date" min={MIN_EVENT_DATE} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="nl-guests">{c.addGuests}</label>
          <input id="nl-guests" name="guest_count" type="number" min={1} max={MAX_GUESTS} inputMode="numeric" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="nl-source">{c.addHow}</label>
          <select id="nl-source" name="source" defaultValue="phone" className="field">
            {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Optional here: whoever is typing is often still on the phone and may
          not have asked yet. */}
      <RegionPicker
        id="nl-location" name="location"
        regions={REGIONS.map((value) => ({ value, label: value }))}
        label={c.addLocation} freeLabel={c.addLocationFree} freePh={c.addLocationPh}
      />

      <div>
        <label className="label" htmlFor="nl-message">{c.addMessage}</label>
        <textarea id="nl-message" name="message" rows={3} placeholder={c.addMessagePh} className="field resize-y" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Submit />
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{c.addCancel}</button>
      </div>
    </form>
  );
}
