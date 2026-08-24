'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitRsvp, type RsvpResult } from '@/app/actions/rsvp';
import { DIETS } from '@/content/lists';
import { rsvpCopy } from '@/content/site';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? rsvpCopy.sending : label}
    </button>
  );
}

export function RsvpForm({ token, initial }: {
  token: string;
  initial: { status: string; partySize: number; diet: string; note: string; responded: boolean };
}) {
  const [state, action] = useActionState<RsvpResult | null, FormData>(submitRsvp, null);
  const [coming, setComing] = useState<'attending' | 'declined' | null>(
    initial.status === 'attending' ? 'attending' : initial.status === 'declined' ? 'declined' : null
  );
  const c = rsvpCopy;

  if (state?.ok) {
    return (
      <div className="card text-center" role="status">
        <div aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-wash text-[22px]">✓</div>
        <h2 className="mt-4 font-display text-title font-semibold text-ink">
          {state.status === 'attending' ? c.okComing : c.okNotComing}
        </h2>
        <p className="mt-2 text-[15.5px] text-ink-soft">
          {state.status === 'attending' ? c.okComingBody : c.okNotComingBody}
        </p>
        <p className="mt-4 text-[13.5px] text-ink-mute">{c.changeLater}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-6" noValidate>
      <input type="hidden" name="token" value={token} />

      {initial.responded && (
        <p className="rounded-2xl bg-surface-200 px-4 py-3 text-[14px] text-ink-soft">{c.already}</p>
      )}
      {state && !state.ok && state.error && (
        <p role="alert" className="rounded-2xl border border-bad/25 bg-bad-wash px-4 py-3 text-[14.5px] text-bad">
          {state.error}
        </p>
      )}

      <fieldset>
        <legend className="label">{c.question}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(['attending', 'declined'] as const).map((v) => (
            <label
              key={v}
              className={`cursor-pointer rounded-2xl border px-5 py-4 text-center text-[15.5px] transition ${
                coming === v ? 'border-ink bg-ink text-white' : 'border-line bg-white/70 text-ink hover:bg-white'
              }`}
            >
              <input
                type="radio" name="status" value={v} required className="sr-only"
                checked={coming === v} onChange={() => setComing(v)}
              />
              {v === 'attending' ? c.yes : c.no}
            </label>
          ))}
        </div>
      </fieldset>

      {/* asking how many and what they eat only makes sense once they are coming */}
      {coming === 'attending' && (
        <>
          <div>
            <label className="label" htmlFor="rsvp-size">{c.howMany}</label>
            <input
              id="rsvp-size" name="party_size" type="number" min={1} max={20} inputMode="numeric"
              defaultValue={initial.partySize || 1} className="field"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-mute">{c.howManyHint}</p>
          </div>

          <div>
            <label className="label" htmlFor="rsvp-diet">{c.diet}</label>
            <select id="rsvp-diet" name="diet" defaultValue={initial.diet || 'none'} className="field">
              {DIETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="label" htmlFor="rsvp-note">{c.note}</label>
        <textarea id="rsvp-note" name="note" rows={2} maxLength={500} defaultValue={initial.note} className="field" placeholder={c.notePh} />
      </div>

      <Submit label={c.submit} />
    </form>
  );
}
