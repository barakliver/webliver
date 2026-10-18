'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, Check, Minus, Plus } from 'lucide-react';
import { submitRsvp, type RsvpResult } from '@/app/actions/rsvp';
import { DIETS } from '@/content/lists';
import type { RsvpCopy } from '@/content/ui';
import { fill } from '@/lib/copyText';
import { Petals } from '@/components/guest/Petals';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/* One all-day entry, built here from the three facts the page already holds.
   A data address rather than a route: the invitation link is a credential and
   a second URL that answers to it is a second thing to protect. */
function icsHref(name: string, date: string, venue: string): string {
  const day = date.replaceAll('-', '');
  const end = new Date(`${date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const next = end.toISOString().slice(0, 10).replaceAll('-', '');
  const esc = (t: string) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//liver//rsvp//HE', 'BEGIN:VEVENT',
    `UID:${day}-${esc(name).length}@liver`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(name)}`, ...(venue ? [`LOCATION:${esc(venue)}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

const ANSWER = {
  attending: 'bg-tone-rubine text-tone-rubine-on',
  declined: 'bg-tone-camel text-tone-camel-on',
} as const;

export function RsvpForm({ token, initial, copy, event }: {
  token: string;
  initial: { status: string; partySize: number; diet: string; note: string; responded: boolean };
  /* A guest at an Israeli wedding may not read Hebrew, and this screen is the
     one thing they are asked to fill in. The wording arrives resolved rather
     than imported, for the same reason as everywhere else: this runs on the
     client and the language is a cookie the server already read. */
  copy: RsvpCopy;
  /** What the calendar entry is made of. */
  event: { name: string; date: string | null; venue: string };
}) {
  const [state, action] = useActionState<RsvpResult | null, FormData>(submitRsvp, null);
  const [coming, setComing] = useState<'attending' | 'declined' | null>(
    initial.status === 'attending' ? 'attending' : initial.status === 'declined' ? 'declined' : null
  );
  const [size, setSize] = useState(Math.min(20, Math.max(1, initial.partySize || 1)));
  const c = copy;

  if (state?.ok) {
    const yes = state.status === 'attending';
    return (
      <div className="relative overflow-hidden p-6 text-center sm:p-8" role="status">
        {yes && <Petals />}
        <div aria-hidden className={`pop-in mx-auto grid size-14 place-items-center rounded-full ${yes ? ANSWER.attending : ANSWER.declined}`}>
          <svg className="draw-check" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
        </div>
        <h2 className="animate-rise mt-4 font-display text-title font-light text-ink">
          {yes ? c.okComing : c.okNotComing}
        </h2>
        <p className="animate-rise mt-2 text-lead text-ink-soft" style={{ animationDelay: '.12s' }}>
          {yes ? c.okComingBody : c.okNotComingBody}
        </p>
        {yes && event.date && (
          <div className="animate-rise mt-5" style={{ animationDelay: '.24s' }}>
            <a href={icsHref(event.name, event.date, event.venue)} download="event.ics" className="btn-ghost inline-flex">
              <CalendarPlus size={16} strokeWidth={1.5} aria-hidden />
              {c.addToCalendar}
            </a>
            <p className="mt-2 text-meta text-ink-mute">{c.calendarDay}</p>
          </div>
        )}
        <p className="mt-5 text-body text-ink-mute">{c.changeLater}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6 p-5 sm:p-7" noValidate>
      <input type="hidden" name="token" value={token} />

      {initial.responded && (
        <p className="rounded-control bg-surface-200 px-4 py-3 text-body text-ink-soft">{c.already}</p>
      )}
      {state && !state.ok && state.error && (
        <p role="alert" className="rounded-control border border-bad/25 bg-bad-wash px-4 py-3 text-body text-bad">
          {state.error}
        </p>
      )}

      <fieldset>
        <legend className="label">{c.question}</legend>
        {/* The two answers are the two biggest things on the screen, and the
            colour of the one chosen is its own: a yes is the rubine and a no is
            the camel, so a guest can see what they have said from across a
            room without reading it. */}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(['attending', 'declined'] as const).map((v) => (
            <label
              key={v}
              className={`relative flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-card px-5 py-4 text-center text-lead transition duration-touch has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                coming === v ? `${ANSWER[v]} scale-[1.02]` : 'border border-line-strong bg-card text-ink hover:bg-surface-100'
              }`}
            >
              <input
                type="radio" name="status" value={v} required className="sr-only"
                checked={coming === v} onChange={() => setComing(v)}
              />
              {coming === v && <Check size={18} strokeWidth={2} aria-hidden className="pop-in" />}
              {v === 'attending' ? c.yes : c.no}
            </label>
          ))}
        </div>
      </fieldset>

      {/* asking how many and what they eat only makes sense once they are coming */}
      {coming === 'attending' && (
        <div className="animate-rise space-y-6">
          <div>
            <p className="label" id="rsvp-size-l">{c.howMany}</p>
            {/* A stepper and not a typed number: nobody on a phone wants the
                keyboard to say they are two. The value still travels as the
                field the action has always read. */}
            <input type="hidden" name="party_size" value={size} />
            <div role="group" aria-labelledby="rsvp-size-l" className="mt-2 flex items-center gap-4">
              <button type="button" onClick={() => setSize((n) => Math.max(1, n - 1))} disabled={size <= 1}
                aria-label={c.less}
                className="grid size-11 place-items-center rounded-full border border-line-strong bg-card text-ink transition duration-touch hover:bg-surface-100 disabled:opacity-40">
                <Minus size={18} strokeWidth={1.75} aria-hidden />
              </button>
              <span key={size} aria-live="polite" className="pop-in w-12 text-center font-display text-[38px] font-light leading-none tabular-nums text-ink">{size}</span>
              <button type="button" onClick={() => setSize((n) => Math.min(20, n + 1))} disabled={size >= 20}
                aria-label={c.more}
                className="grid size-11 place-items-center rounded-full border border-line-strong bg-card text-ink transition duration-touch hover:bg-surface-100 disabled:opacity-40">
                <Plus size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-meta text-ink-mute">
              {size === 1 ? c.seatKept : fill(c.seatsKept, { n: size })}. {c.howManyHint}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="rsvp-diet">{c.diet}</label>
            <select id="rsvp-diet" name="diet" defaultValue={initial.diet || 'none'} className="field">
              {DIETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="rsvp-note">{c.note}</label>
        <textarea id="rsvp-note" name="note" rows={2} maxLength={500} defaultValue={initial.note} className="field" placeholder={c.notePh} />
      </div>

      <Submit label={c.submit} busy={c.sending} />
    </form>
  );
}
