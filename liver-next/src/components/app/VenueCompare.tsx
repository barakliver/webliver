'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Paperclip, Plus, Printer, Trash2, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Money } from '@/components/Ltr';
import type { VenueCopy } from '@/content/appUi';
import {
  cost, bestValue, overCheapest, VENUE_FLAGS, type Venue, type VenueFlag,
} from '@/lib/venues';
import {
  saveVenue, removeVenue, tuneVenue, chooseVenue, setGuestCommitment, type VenueResult,
} from '@/app/actions/venues';

/**
 * Four halls, one number each.
 *
 * The comparison a couple cannot make on their own. Each hall hands them a
 * quote in its own shape — a plate before VAT here, a flat bar there, sound
 * and lighting left out entirely at the third because "that is with your DJ" —
 * and the only number all of them said out loud is the plate price, so that is
 * the number the couple compares. It is the wrong one, and they find that out
 * in March.
 *
 * Everything arithmetic lives in `lib/venues.ts` and is tested there. This
 * file's job is the part that has to be looked at rather than proved: the
 * columns side by side, the figure that moves when the guest count moves, and
 * a chosen hall that reads as chosen.
 *
 * Both sides own it. The producer knows what the ancillary line usually hides;
 * the couple knows which one their mother liked. There is nothing to negotiate
 * between them, so there is one panel and not two.
 */

export type VenueRow = Venue;

export function VenueCompare({ c, clientId, venues, guestEstimate, quoteUrls, canChoose = true }: {
  c: VenueCopy;
  clientId: string;
  venues: VenueRow[];
  /** The event's own guest number. Shared on purpose: see `guestsHint`. */
  guestEstimate: number;
  /** Signed links for the halls' own quotes. The bucket is private. */
  quoteUrls: Record<string, string>;
  canChoose?: boolean;
}) {
  /* Local so the columns move as the number is typed, and saved on the way
     out so the producer sees the same number on their screen. */
  const [guests, setGuests] = useState(guestEstimate || 0);
  const [withVat, setWithVat] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { setGuests(guestEstimate || 0); }, [guestEstimate]);

  const costed = useMemo(
    () => venues.map((v) => ({ v, k: cost(v, guests, withVat) })),
    [venues, guests, withVat],
  );
  const best = useMemo(
    () => bestValue(costed.map(({ v, k }) => ({ id: v.id, total: k.total }))),
    [costed],
  );
  const cheapest = useMemo(
    () => (costed.length ? Math.min(...costed.map(({ k }) => k.total)) : 0),
    [costed],
  );

  return (
    <section className="print-doc print-wide space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 max-w-prose text-[13.5px] text-ink-soft">{c.sub}</p>
        </div>
        <div className="flex shrink-0 gap-2 no-print">
          <button type="button" onClick={() => window.print()} className="btn-ghost min-h-[38px] px-3 text-[13.5px]">
            <Printer size={15} strokeWidth={1.5} aria-hidden />
            {c.print}
          </button>
          {!adding && (
            <button type="button" onClick={() => { setAdding(true); setEditing(null); }}
              className="btn-primary min-h-[38px] px-3.5 text-[13.5px]">
              <Plus size={15} strokeWidth={1.5} aria-hidden />
              {c.add}
            </button>
          )}
        </div>
      </header>

      {/* The two controls the whole screen is read through. Above the columns
          rather than beside one, because they belong to the comparison. */}
      <div className="card flex flex-wrap items-end gap-x-6 gap-y-3">
        <form action={setGuestCommitment} className="min-w-[9rem]">
          <input type="hidden" name="client_id" value={clientId} />
          <label className="label" htmlFor="venue-guests">{c.guests}</label>
          <input
            id="venue-guests" name="guests" inputMode="numeric" value={guests || ''}
            onChange={(e) => setGuests(Math.max(0, Math.min(5000, Number.parseInt(e.target.value, 10) || 0)))}
            /* Saved when they leave the field rather than on every keystroke:
               a number being typed passes through 2, 25 and 250, and writing
               all three would put 2 on the producer's screen. */
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            className="field mt-1 w-32 tabular-nums"
          />
        </form>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] text-ink">
          <input type="checkbox" checked={withVat} onChange={(e) => setWithVat(e.target.checked)} className="size-4" />
          {c.vatBasis}
        </label>

        <p className="w-full text-[12.5px] leading-snug text-ink-mute">{c.guestsHint}</p>
      </div>

      {adding && (
        <VenueForm c={c} clientId={clientId} onDone={() => setAdding(false)} />
      )}

      {venues.length === 0 && !adding ? (
        <div className="card">
          <p className="text-[15px] text-ink">{c.empty}</p>
          <p className="mt-1 text-[13.5px] text-ink-soft">{c.emptySub}</p>
        </div>
      ) : (
        /* A column per hall, scrolling sideways on a phone rather than
           stacking: the whole value of this screen is two figures next to
           each other, and a stack is four screens with one figure each. */
        <div className="-mx-5 overflow-x-auto px-5 pb-1 [contain:paint] sm:mx-0 sm:px-0">
          <ul className="flex list-none gap-3 p-0">
            {costed.map(({ v, k }) => (
              <li key={v.id} className="print-block w-[17rem] shrink-0">
                {editing === v.id ? (
                  <VenueForm c={c} clientId={clientId} venue={v} onDone={() => setEditing(null)} />
                ) : (
                  <Column
                    c={c} clientId={clientId} v={v} k={k} guests={guests}
                    isBest={v.id === best}
                    over={overCheapest(k.total, cheapest)}
                    quoteUrl={quoteUrls[v.quotePath] ?? ''}
                    canChoose={canChoose}
                    onEdit={() => { setEditing(v.id); setAdding(false); }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── one hall ───────────────────────────────────────────────────────────── */

function Column({ c, clientId, v, k, guests, isBest, over, quoteUrl, canChoose, onEdit }: {
  c: VenueCopy;
  clientId: string;
  v: VenueRow;
  k: ReturnType<typeof cost>;
  guests: number;
  isBest: boolean;
  over: number;
  quoteUrl: string;
  canChoose: boolean;
  onEdit: () => void;
}) {
  const flags = v.prosCons as VenueFlag[];

  return (
    <article className={`card flex h-full flex-col ${v.isSelected ? 'border-accent' : ''}`}>
      <header>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] font-semibold text-ink">{v.venueName}</h3>
          <form action={removeVenue} className="no-print">
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button type="submit" aria-label={c.remove}
              className="rounded-xl2 p-1 text-ink-mute transition hover:bg-bad-wash hover:text-bad">
              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </form>
        </div>
        {v.location && <p className="text-[13px] text-ink-soft">{v.location}</p>}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {v.isSelected && <span className="chip-ok">{c.chosen}</span>}
          {isBest && !v.isSelected && <span className="chip-ok">{c.bestValue}</span>}
          {over > 0 && (
            <span className="chip-mute tabular-nums">{c.overCheapest.replace('{n}', String(over))}</span>
          )}
        </div>
      </header>

      {/* The figure the hall never quotes, given the most room on the card. */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="eyebrow">{c.perGuest}</p>
        <p className="font-display text-[26px] font-semibold text-ink">
          <Money value={k.perGuest} />
        </p>
      </div>

      <dl className="mt-3 space-y-1 text-[13.5px]">
        <Line label={c.food} value={k.food} />
        {k.bar > 0 && <Line label={c.bar} value={k.bar} />}
        {k.soundLighting > 0 && <Line label={c.sound} value={k.soundLighting} />}
        {k.ancillary > 0 && <Line label={c.ancillary} value={k.ancillary} />}
        {k.service > 0 && <Line label={c.service} value={k.service} />}
        <div className="flex items-baseline justify-between gap-2 border-t border-line pt-1.5">
          <dt className="text-ink">{c.total}</dt>
          <dd className="font-display text-[17px] font-semibold text-ink"><Money value={k.total} /></dd>
        </div>
      </dl>

      <Buffer c={c} clientId={clientId} v={v} total={k.total} />

      <Flags c={c} clientId={clientId} v={v} flags={flags} />

      {v.notes && <p className="mt-3 text-[12.5px] leading-snug text-ink-mute">{v.notes}</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-4 no-print">
        <button type="button" onClick={onEdit} className="btn-quiet min-h-[34px] px-3 text-[13px]">{c.edit}</button>
        {quoteUrl && (
          <a href={quoteUrl} target="_blank" rel="noopener noreferrer"
            className="btn-quiet inline-flex min-h-[34px] items-center gap-1.5 px-3 text-[13px]">
            <Paperclip size={13} strokeWidth={1.5} aria-hidden />
            {c.quoteOpen}
          </a>
        )}
        {canChoose && !v.isSelected && (
          <form action={chooseVenue}>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="guests" value={guests} />
            <button type="submit" className="btn-primary min-h-[34px] px-3 text-[13px]">
              <Check size={14} strokeWidth={1.5} aria-hidden />
              {c.choose}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums text-ink"><Money value={value} /></dd>
    </div>
  );
}

/**
 * The buffer.
 *
 * A slider rather than a field because the question it answers is "and if it
 * runs over?", which is a feeling before it is a number. Saved on release
 * rather than on every pixel: dragging from ten to twenty passes through
 * eleven values and writing all of them is eleven rows of noise on the
 * producer's screen.
 */
function Buffer({ c, clientId, v, total }: {
  c: VenueCopy; clientId: string; v: VenueRow; total: number;
}) {
  const [pct, setPct] = useState(v.contingencyPercent);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { setPct(v.contingencyPercent); }, [v.contingencyPercent]);

  /* From the percentage under the thumb rather than the one in the database.
     Reading the saved figure meant the number stood still while the slider
     moved and only caught up after the write, which is the screen telling
     somebody their drag did nothing. */
  const shown = Math.round(total * (1 + pct / 100) * 100) / 100;

  return (
    <form ref={form} action={tuneVenue} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="field" value="contingency_percent" />
      <input type="hidden" name="value" value={pct} />

      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13.5px] text-ink-soft" htmlFor={`buf-${v.id}`}>
          {c.buffer} <span className="tabular-nums">{pct}%</span>
        </label>
        <span className="font-display text-[15px] font-semibold text-ink tabular-nums">
          <Money value={shown} />
        </span>
      </div>
      <input
        id={`buf-${v.id}`} type="range" min={0} max={20} step={1} value={pct}
        onChange={(e) => setPct(Number.parseInt(e.target.value, 10))}
        onPointerUp={() => form.current?.requestSubmit()}
        onKeyUp={() => form.current?.requestSubmit()}
        className="mt-1.5 w-full accent-accent no-print"
      />
      <p className="mt-1 text-[12px] text-ink-mute no-print">{c.withBuffer}</p>
    </form>
  );
}

function Flags({ c, clientId, v, flags }: {
  c: VenueCopy; clientId: string; v: VenueRow; flags: VenueFlag[];
}) {
  const has = new Set(flags);
  return (
    <form action={tuneVenue} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="field" value="flags" />

      <p className="eyebrow">{c.flags}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {VENUE_FLAGS.map((f) => (
          <label key={f} className={`inline-flex cursor-pointer items-center gap-1 rounded-xl2 border px-2 py-1 text-[12px] transition ${
            has.has(f) ? 'border-ok bg-ok-wash text-ok' : 'border-line text-ink-mute hover:text-ink'
          }`}>
            <input
              type="checkbox" name="flag" value={f} defaultChecked={has.has(f)} className="sr-only"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            {has.has(f) ? <Check size={11} strokeWidth={2} aria-hidden /> : <X size={11} strokeWidth={1.5} aria-hidden />}
            {c.flagLabels[f]}
          </label>
        ))}
      </div>
    </form>
  );
}

/* ── adding one, or fixing what a hall told you on the phone ─────────────── */

const MAX_BYTES = 10 * 1024 * 1024;

function VenueForm({ c, clientId, venue, onDone }: {
  c: VenueCopy; clientId: string; venue?: VenueRow; onDone: () => void;
}) {
  const [state, action, pending] = useActionState<VenueResult | null, FormData>(saveVenue, null);
  const [path, setPath] = useState(venue?.quotePath ?? '');
  const [busy, setBusy] = useState(false);
  const [upErr, setUpErr] = useState('');

  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Straight into storage from the browser, like every other upload here: a
     quote is a PDF off a phone and a server action would refuse it at one
     megabyte, silently, before it ran. */
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUpErr('');
    if (file.size > MAX_BYTES) { setUpErr(c.tooBig); return; }
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const key = `${clientId}/${crypto.randomUUID()}.${ext || 'pdf'}`;
    const { error } = await supabaseBrowser().storage.from('files')
      .upload(key, file, { contentType: file.type || 'application/pdf', upsert: false });
    setBusy(false);
    if (error) { setUpErr(c.uploadFailed); return; }
    /* The one it replaces, unless that is the quote already saved on this
       hall — that one belongs to a row and goes when the row goes. */
    if (path && path !== venue?.quotePath) {
      void supabaseBrowser().storage.from('files').remove([path]).catch(() => {});
    }
    setPath(key);
  };

  return (
    <form action={action} className="card space-y-3 no-print">
      {venue && <input type="hidden" name="id" value={venue.id} />}
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="quote_path" value={path} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={c.name}>
          <input name="venue_name" required maxLength={120} defaultValue={venue?.venueName}
            placeholder={c.namePh} className="field w-full" autoComplete="off" />
        </Field>
        <Field label={c.location}>
          <input name="location" maxLength={120} defaultValue={venue?.location}
            placeholder={c.locationPh} className="field w-full" autoComplete="off" />
        </Field>
        <Field label={c.contact}>
          <input name="contact" maxLength={120} defaultValue={venue?.contact} className="field w-full" autoComplete="off" />
        </Field>
        <Field label={c.phone}>
          <input name="phone" inputMode="tel" maxLength={40} defaultValue={venue?.phone} className="field w-full" autoComplete="off" />
        </Field>
        <Field label={c.toured}>
          <input name="toured_on" type="date" defaultValue={venue?.touredOn ?? ''} className="field w-full" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={c.plate}>
          <input name="plate_price" inputMode="decimal" defaultValue={venue?.platePrice || ''} className="field w-full tabular-nums" />
        </Field>
        <Field label={c.bar}>
          <div className="flex gap-2">
            <input name="bar_cost" inputMode="decimal" defaultValue={venue?.barCost || ''} className="field w-full tabular-nums" />
            <select name="bar_type" defaultValue={venue?.barType ?? 'flat'} className="field shrink-0">
              <option value="flat">{c.barFlat}</option>
              <option value="per_person">{c.barPerPerson}</option>
            </select>
          </div>
        </Field>
        <Field label={c.sound}>
          <input name="sound_lighting_cost" inputMode="decimal" defaultValue={venue?.soundLightingCost || ''} className="field w-full tabular-nums" />
        </Field>
        <Field label={c.ancillary} hint={c.ancillaryHint}>
          <input name="ancillary_fees" inputMode="decimal" defaultValue={venue?.ancillaryFees || ''} className="field w-full tabular-nums" />
        </Field>
        <Field label={c.servicePercent}>
          <input name="service_percent" inputMode="decimal" defaultValue={venue?.servicePercent || ''} className="field w-full tabular-nums" />
        </Field>
        <Field label={c.serviceFlat}>
          <input name="service_flat" inputMode="decimal" defaultValue={venue?.serviceFlat || ''} className="field w-full tabular-nums" />
        </Field>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] text-ink">
        <input type="checkbox" name="is_vat_included" defaultChecked={venue?.isVatIncluded} className="size-4" />
        {c.vatIncluded}
      </label>

      <Field label={c.notes}>
        <textarea name="notes" rows={2} maxLength={2000} defaultValue={venue?.notes}
          placeholder={c.notesPh} className="field w-full" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost inline-flex min-h-[38px] cursor-pointer items-center gap-2 px-3 text-[13.5px]">
          <input type="file" accept=".pdf,image/*" className="sr-only"
            onChange={(e) => void upload(e.target.files?.[0])} />
          {busy ? <Loader2 size={15} strokeWidth={1.5} aria-hidden className="animate-spin" />
                : <Paperclip size={15} strokeWidth={1.5} aria-hidden />}
          {c.quote}
        </label>
        {path && <span className="chip-ok">{c.quote}</span>}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="submit" disabled={pending} className="btn-primary min-h-[38px] px-4 text-[14px]">
          {pending ? <Loader2 size={15} strokeWidth={1.5} aria-hidden className="animate-spin" />
                   : <Check size={15} strokeWidth={1.5} aria-hidden />}
          {pending ? c.saving : c.save}
        </button>
        <button type="button" onClick={onDone} className="btn-quiet min-h-[38px] px-4 text-[14px]">{c.cancel}</button>
      </div>

      {state?.ok === false && state.error && <Err text={state.error} />}
      {upErr && <Err text={upErr} />}
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] leading-snug text-ink-mute">{hint}</span>}
    </label>
  );
}

function Err({ text }: { text: string }) {
  return <p role="status" className="text-[13.5px] text-bad">{text}</p>;
}
