'use client';

import { fill } from '@/lib/copyText';
import { eventKindsFor } from '@/content/ui';
import type { Locale } from '@/lib/locale';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, Pencil } from 'lucide-react';
import { updateClientDetails, type ActionResult } from '@/app/actions/clients';
import { MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';
import { useCopy } from '@/components/app/CopyProvider';
import { formatDate, daysUntil } from '@/lib/dates';
import { EVENT_ZONE } from '@/lib/clock';


const dateFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE,
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

export type EventCore = {
  id: string;
  display_name: string;
  kind: string;
  event_date: string | null;
  venue: string | null;
  guest_estimate: number | null;
  /* Carried from the enquiry. Present on an event that came from a lead and
     empty on one the producer opened directly, which is a real case rather
     than missing data — so the rows below appear rather than reading as
     blanks somebody forgot to fill in. */
  contact_email?: string;
  contact_phone?: string;
  brief?: string;
};

function Save() {
  const c = useCopy().clientPage;
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
  const locale = useCopy().locale;
  const ui = useCopy();
  const c = useCopy().clientPage;
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev, form) => {
      const r = await updateClientDetails(prev, form);
      if (r.ok) close();
      return r;
    },
    null
  );

  /* The pencil beside the event's name at the top of the page points here
     with `#event-details`. It used to scroll to this card and stop, leaving
     a person in front of a second, smaller pencil — which read as a button
     that did nothing. Arriving on the hash now opens the form itself, from
     this tab or after a full navigation from another, and scrolls to it.
     Closing clears the hash, so the pencil works a second time too. */
  useEffect(() => {
    const arrive = () => {
      if (window.location.hash !== '#event-details') return;
      setEditing(true);
      window.setTimeout(() => document.getElementById('event-details')?.scrollIntoView({ block: 'start' }), 0);
    };
    arrive();
    window.addEventListener('hashchange', arrive);
    return () => window.removeEventListener('hashchange', arrive);
  }, []);
  const close = () => {
    setEditing(false);
    if (window.location.hash === '#event-details') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const kind = eventKindsFor(locale).find((k) => k.value === event.kind)?.label ?? event.kind;
  /* Null covers both "no date yet" and "a date nothing can parse", and the
     screen treats them the same: offer the date picker rather than throw. */
  const left = daysUntil(event.event_date);

  if (editing) {
    return (
      /* The same id while the form is open, so the pencil's target does not
         vanish the moment it is used. */
      <section id="event-details" className="card scroll-mt-24">
        <form action={action} noValidate>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.edit}</h2>
          <input type="hidden" name="client_id" value={event.id} />

          {state && !state.ok && state.error && (
            <p role="alert" className="mt-4 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-3 text-[14.5px] text-bad">
              {state.error}
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ed-name">{ui.newClient.name}</label>
              <input id="ed-name" name="display_name" required defaultValue={event.display_name} className="field" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="ed-kind">{ui.newClient.kind}</label>
              <select id="ed-kind" name="kind" defaultValue={event.kind} className="field">
                {eventKindsFor(locale).map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ed-date">{ui.newClient.date}</label>
              <input
                id="ed-date" name="event_date" type="date" min={MIN_EVENT_DATE}
                defaultValue={event.event_date ?? ''} className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="ed-venue">{ui.newClient.venue}</label>
              <input id="ed-venue" name="venue" defaultValue={event.venue ?? ''} className="field" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="ed-guests">{ui.newClient.guests}</label>
              <input
                id="ed-guests" name="guest_estimate" type="number" min={1} max={MAX_GUESTS} inputMode="numeric"
                defaultValue={event.guest_estimate ?? ''} className="field"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Save />
            <button type="button" className="btn-ghost" onClick={close}>{c.editCancel}</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    /* Named so the title at the top of the page can point at it. Renaming an
       event lives here and only here, and it is below the templates and below
       the fold — which is why the person who owns the platform could not find
       it and asked for a rename that already existed. */
    <section id="event-details" className="card scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-[18px] font-semibold text-ink">{c.details}</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-mute transition hover:text-accent"
        >
          <Pencil size={14} aria-hidden strokeWidth={1.5} />
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
          className="mt-5 inline-flex items-center gap-2 rounded-xl2 border border-dashed border-line-strong px-4 py-3 text-[14.5px] text-ink-soft transition hover:border-accent/50 hover:text-accent"
        >
          <CalendarPlus size={16} aria-hidden strokeWidth={1.5} />
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
              {left === 0 ? c.today : left === 1 ? c.tomorrow : `${c.passed} ${fill(c.daysAgo, { n: -left })}`}
            </span>
          )}
        </div>
      )}

      <dl className="mt-6 space-y-3 text-[14.5px]">
        <Line label={ui.newClient.kind}>{kind}</Line>
        <Line label={ui.newClient.date}>
          {formatDate(dateFmtFor(locale), event.event_date, c.noDateYet)}
        </Line>
        <Line label={ui.newClient.venue}>{event.venue || c.at.none}</Line>
        <Line label={ui.newClient.guests}>{event.guest_estimate ?? c.at.none}</Line>

        {/* The number the producer actually calls, as something they can press
            rather than something they have to select and copy. This was on the
            leads screen and nowhere else, so the first thing anybody did after
            converting an enquiry was go back to look it up. */}
        {event.contact_phone && (
          <Line label={c.contact.phone}>
            <a href={`tel:${event.contact_phone.replace(/[^\d+]/g, '')}`} className="text-accent hover:underline" dir="ltr">
              {event.contact_phone}
            </a>
          </Line>
        )}
        {event.contact_email && (
          <Line label={c.contact.email}>
            <a href={`mailto:${event.contact_email}`} className="text-accent hover:underline" dir="ltr">
              {event.contact_email}
            </a>
          </Line>
        )}
      </dl>

      {/* What they wrote when they enquired, kept verbatim. It is the only
          thing on this file in the couple's own words, and it answers the
          question the producer is about to ask them again. */}
      {event.brief && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="label">{c.contact.brief}</p>
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">{event.brief}</p>
        </div>
      )}
    </section>
  );
}
