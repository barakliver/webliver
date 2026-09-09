'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BookmarkPlus, Lock, Plus, Trash2, Truck } from 'lucide-react';
import {
  addEventVendor, bookVendor, setEventVendorStatus, removeEventVendor, promoteToDirectory,
  type VendorResult,
} from '@/app/actions/vendors';
import { VENDOR_CATEGORIES, VENDOR_STATES, categoryLabel } from '@/content/production';
import { vendorCopy as c } from '@/content/site';
import { hhmm } from '@/lib/runsheet';

export type EventVendor = {
  id: string; vendor_id: string | null; name: string; category: string;
  phone: string; status: string; call_time: string | null; notes: string;
};

export type DirectoryEntry = { id: string; name: string; category: string; phone: string };

function Save() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

const statusTone: Record<string, string> = {
  booked: 'bg-ok-wash text-ok',
  shortlist: 'bg-warn-wash text-warn',
  cancelled: 'bg-surface-200 text-ink-mute',
};

/**
 * The suppliers on one event.
 *
 * Two ways in, because there are two kinds of supplier. The florist who works
 * every August is picked from the directory in one click and arrives with her
 * number already filled in. The generator company hired once for a field in the
 * Galilee is typed straight in, and can be filed into the directory afterwards
 * if it turns out to be worth keeping.
 *
 * What is booked here is who and how to reach them. What it costs lives in the
 * budget, which is the only place a figure is allowed to live, so the two can
 * never disagree in front of a client.
 */
export function EventVendors({ clientId, vendors, directory }: {
  clientId: string; vendors: EventVendor[]; directory: DirectoryEntry[];
}) {
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [state, action] = useActionState<VendorResult | null, FormData>(
    async (prev, form) => {
      const r = await addEventVendor(prev, form);
      if (r.ok) setAdding(false);
      return r;
    },
    null
  );

  const booked = new Set(vendors.map((v) => v.vendor_id).filter(Boolean));
  const available = directory.filter((d) => !booked.has(d.id));

  /* Grouped by what they do, because that is how a producer checks the list:
     not "is everyone here" but "who is doing the flowers". */
  const byCategory = new Map<string, EventVendor[]>();
  for (const v of vendors) {
    const key = v.category || 'other';
    byCategory.set(key, [...(byCategory.get(key) ?? []), v]);
  }
  const groups = [...byCategory.entries()].sort((a, b) =>
    categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), 'he')
  );

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-semibold text-ink">
            <Truck size={18} aria-hidden strokeWidth={1.75} />
            {c.eventTitle}
          </h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.eventSub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {available.length > 0 && (
            <button
              type="button"
              onClick={() => { setPicking((v) => !v); setAdding(false); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
            >
              {picking ? c.close : c.fromDirectory}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setAdding((v) => !v); setPicking(false); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
          >
            <Plus size={15} aria-hidden strokeWidth={2} />
            {adding ? c.close : c.add}
          </button>
        </div>
      </div>

      {picking && (
        <ul className="mt-4 grid gap-2 rounded-2xl border border-line bg-surface-100 p-3 sm:grid-cols-2">
          {available.map((d) => (
            <li key={d.id}>
              <form action={bookVendor} className="flex items-center gap-3 rounded-xl2 bg-card px-3.5 py-2.5">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="vendor_id" value={d.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{d.name}</span>
                  <span className="block text-[12.5px] text-ink-mute">{categoryLabel(d.category)}</span>
                </span>
                <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.bookIt}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form action={action} className="mt-4 rounded-2xl border border-line bg-surface-100 p-4" noValidate>
          <input type="hidden" name="client_id" value={clientId} />
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_1fr]">
            <div>
              <label className="label">{c.name}</label>
              <input name="name" required autoComplete="off" className="field" />
            </div>
            <div>
              <label className="label">{c.category}</label>
              <select name="category" defaultValue="other" className="field">
                {VENDOR_CATEGORIES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{c.phone}</label>
              <input name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="off" className="field" />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[140px_150px_1fr]">
            <div>
              <label className="label">{c.status}</label>
              <select name="status" defaultValue="shortlist" className="field">
                {VENDOR_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{c.callTime}</label>
              <input name="call_time" type="time" className="field" />
            </div>
            <div>
              <label className="label">{c.notes}</label>
              <input name="notes" autoComplete="off" className="field" />
            </div>
          </div>
          {state && !state.ok && state.error && (
            <p role="alert" className="mt-3 rounded-2xl border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
              {state.error}
            </p>
          )}
          <div className="mt-4"><Save /></div>
        </form>
      )}

      {vendors.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.eventNone}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map(([category, list]) => (
            <div key={category}>
              <h3 className="mb-2 text-[12.5px] font-semibold text-accent">{categoryLabel(category)}</h3>
              <ul className="space-y-2.5">
                {list.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px] text-ink">{v.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-mute">
                        {v.phone && <a href={`tel:${v.phone}`} dir="ltr" className="hover:text-accent">{v.phone}</a>}
                        {v.call_time && <span className="tabular-nums" dir="ltr">{hhmm(v.call_time)}</span>}
                        {v.vendor_id && <span className="text-ink-mute">{c.inDirectory}</span>}
                      </div>
                      {v.notes && <p className="mt-0.5 text-[13px] text-ink-soft">{v.notes}</p>}
                    </div>

                    <form action={setEventVendorStatus}>
                      <input type="hidden" name="event_vendor_id" value={v.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <select
                        name="status"
                        defaultValue={v.status}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        aria-label={`${c.status} ${v.name}`}
                        className={`rounded-full border-0 px-3 py-1.5 text-[12.5px] font-medium ${statusTone[v.status] ?? ''}`}
                      >
                        {VENDOR_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </form>

                    {!v.vendor_id && (
                      <form action={promoteToDirectory}>
                        <input type="hidden" name="event_vendor_id" value={v.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <button
                          type="submit" title={c.saveToDirectory} aria-label={`${c.saveToDirectory}: ${v.name}`}
                          className="rounded-full p-1.5 text-ink-mute transition hover:bg-surface-200 hover:text-accent"
                        >
                          <BookmarkPlus size={15} aria-hidden strokeWidth={1.75} />
                        </button>
                      </form>
                    )}

                    <form action={removeEventVendor}>
                      <input type="hidden" name="event_vendor_id" value={v.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <button
                        type="submit" title={c.remove} aria-label={`${c.remove} ${v.name}`}
                        className="rounded-full p-1.5 text-ink-mute transition hover:bg-bad-wash hover:text-bad"
                      >
                        <Trash2 size={15} aria-hidden strokeWidth={1.75} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
        <Lock size={13} aria-hidden strokeWidth={1.75} />
        {c.privateNote}
      </p>
    </section>
  );
}
