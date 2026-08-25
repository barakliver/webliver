'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, Pencil } from 'lucide-react';
import { updateClientDetails, type ActionResult } from '@/app/actions/clients';
import { appCopy, EVENT_KINDS, MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';

const c = appCopy.clientPage;

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

export type EventCore = {
  id: string;
  display_name: string;
  kind: string;
  event_date: string | null;
  venue: string | null;
  guest_estimate: number | null;
};

/** Whole days from today to the event, counted on calendar dates so a late
 *  evening visit does not shave a day off the countdown. */
function daysUntil(iso: string): number {
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(iso);
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.editSaving : c.editSave}
    </button>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-mute">{label}</dt>
      <dd className="text-left text-ink-soft">{children}</dd>
    </div>
  );
}

/**
 * The head of the event file: what this event is, and how long there is.
 *
 * It could show a date and not set one, which is a strange thing to find on a
 * workspace opened from an enquiry that had no date yet. The countdown, the
 * calendar entry and the run sheet header were all waiting on a field with no
 * way in, and the only route to one was to delete the event and make it again.
 */
export function EventDetails({ event }: { event: EventCore }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev, form) => {
      const r = await updateClientDetails(prev, form);
      if (r.ok) setEditing(false);
      return r;
    },
    null
  );

  const kind = EVENT_KINDS.find((k) => k.value === event.kind)?.label ?? event.kind;
  const left = event.event_date ? daysUntil(event.event_date) : null;

  if (editing) {
    return (
      <section className="card">
        <form action={action} noValidate>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.edit}</h2>
          <input type="hidden" name="client_id" value={event.id} />

          {state && !state.ok && state.error && (
            <p role="alert" className="mt-4 rounded-2xl border border-bad/25 bg-bad-wash px-4 py-3 text-[14.5px] text-bad">
              {state.error}
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ed-name">{appCopy.newClient.name}</label>
              <input id="ed-name" name="display_name" required defaultValue={event.display_name} className="field" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="ed-kind">{appCopy.newClient.kind}</label>
              <select id="ed-kind" name="kind" defaultValue={event.kind} className="field">
                {EVENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ed-date">{appCopy.newClient.date}</label>
              <input
                id="ed-date" name="event_date" type="date" min={MIN_EVENT_DATE}
                defaultValue={event.event_date ?? ''} className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="ed-venue">{appCopy.newClient.venue}</label>
              <input id="ed-venue" name="venue" defaultValue={event.venue ?? ''} className="field" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="ed-guests">{appCopy.newClient.guests}</label>
              <input
                id="ed-guests" name="guest_estimate" type="number" min={1} max={MAX_GUESTS} inputMode="numeric"
                defaultValue={event.guest_estimate ?? ''} className="field"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Save />
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>{c.editCancel}</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-[18px] font-semibold text-ink">{c.details}</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-mute transition hover:text-accent"
        >
          <Pencil size={14} aria-hidden strokeWidth={1.75} />
          {c.edit}
        </button>
      </div>

      {/* The countdown is the first thing anybody wants from this page, so it
          is the largest thing on it. An event with no date gets the button
          that fixes that instead, rather than a dash that says nothing about
          what to do next. */}
      {left === null ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-[14.5px] text-ink-soft transition hover:border-accent/50 hover:text-accent"
        >
          <CalendarPlus size={16} aria-hidden strokeWidth={1.75} />
          {c.setDate}
        </button>
      ) : (
        <div className="mt-5 flex items-baseline gap-2.5">
          {left > 1 ? (
            <>
              <span className="font-display text-[40px] font-semibold leading-none text-ink tabular-nums">{left}</span>
              <span className="text-[15px] text-ink-mute">{c.daysLeft}</span>
            </>
          ) : (
            <span className="font-display text-[24px] font-semibold leading-none text-ink">
              {left === 0 ? c.today : left === 1 ? c.tomorrow : `${c.passed} ${c.daysAgo(-left)}`}
            </span>
          )}
        </div>
      )}

      <dl className="mt-6 space-y-3 text-[14.5px]">
        <Line label={appCopy.newClient.kind}>{kind}</Line>
        <Line label={appCopy.newClient.date}>
          {event.event_date ? dateFmt.format(new Date(event.event_date)) : c.noDateYet}
        </Line>
        <Line label={appCopy.newClient.venue}>{event.venue || c.at.none}</Line>
        <Line label={appCopy.newClient.guests}>{event.guest_estimate ?? c.at.none}</Line>
      </dl>
    </section>
  );
}
