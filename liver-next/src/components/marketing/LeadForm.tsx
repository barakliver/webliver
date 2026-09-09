'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitLead, type LeadResult } from '@/app/actions/lead';
import { MIN_EVENT_DATE, MAX_GUESTS, REGIONS, type SiteCopy } from '@/content/site';
import type { EventKinds } from '@/content/ui';
import { RegionPicker } from '@/components/RegionPicker';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/* The copy arrives resolved. This runs on the client, so importing the site
   constant here shipped the Hebrew form to an English visitor no matter what
   the rest of the page said. */
export function LeadForm({ compact = false, site, kinds }: {
  compact?: boolean; site: SiteCopy; kinds: EventKinds;
}) {
  const [state, action] = useActionState<LeadResult | null, FormData>(submitLead, null);

  if (state?.ok) {
    return (
      <div className="card text-center" role="status">
        <div aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-wash text-[22px]">✓</div>
        <h3 className="mt-4 font-display text-title font-semibold text-ink">{site.lead.okTitle}</h3>
        <p className="mt-2 text-[16px] text-ink-soft">{site.lead.okBody}</p>
      </div>
    );
  }

  const err = state && !state.ok ? state : null;
  const invalid = (f: string) => (err?.field === f ? 'true' : undefined) as 'true' | undefined;

  return (
    <form action={action} className={compact ? 'space-y-4' : 'card space-y-5'} noValidate>
      {err && (
        <p role="alert" className="rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-3 text-[14.5px] text-bad">
          {err.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lf-name">{site.lead.fields.name}</label>
          <input id="lf-name" name="full_name" required autoComplete="name" className="field" aria-invalid={invalid('full_name')} />
        </div>
        <div>
          <label className="label" htmlFor="lf-phone">{site.lead.fields.phone}</label>
          <input id="lf-phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel" className="field" aria-invalid={invalid('phone')} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="lf-email">{site.lead.fields.email}</label>
        <input id="lf-email" name="email" type="email" required autoComplete="email" className="field" aria-invalid={invalid('email')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="lf-kind">{site.lead.fields.kind}</label>
          <select id="lf-kind" name="kind" className="field" defaultValue="wedding">
            {kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lf-date">{site.lead.fields.date}</label>
          <input id="lf-date" name="event_date" type="date" min={MIN_EVENT_DATE} className="field" aria-invalid={invalid('event_date')} />
        </div>
        <div>
          <label className="label" htmlFor="lf-guests">{site.lead.fields.guests}</label>
          <input id="lf-guests" name="guest_count" type="number" min={1} max={MAX_GUESTS} inputMode="numeric" className="field" aria-invalid={invalid('guest_count')} />
        </div>
      </div>

      {/* Worth asking, not worth refusing over. It is the first thing the
          producer asks on the call, but somebody enquiring before they have
          settled on a region is still somebody to call back — and a form that
          turns them away to protect a field is a form that loses the lead. */}
      <RegionPicker
        id="lf-location" name="location"
        regions={REGIONS.map((value, i) => ({ value, label: site.lead.regions[i] }))}
        label={site.lead.fields.location} freeLabel={site.lead.locationFree} freePh={site.lead.locationPh}
        invalid={!!invalid('location')}
      />

      <div>
        <label className="label" htmlFor="lf-msg">{site.lead.fields.message}</label>
        <textarea id="lf-msg" name="message" rows={3} className="field resize-y" />
      </div>

      <Submit label={site.lead.submit} busy={site.lead.sending} />
    </form>
  );
}
