'use client';

import { useMemo, useState } from 'react';
import { Radar, Copy, Check, MessageCircle, Phone } from 'lucide-react';
import { count as plural, fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';
import { vendorCategoriesFor, categoryLabelFor } from '@/content/production';
import { shortDate } from '@/lib/appDates';
import { todayInZone } from '@/lib/clock';
import { Money } from '@/components/Ltr';
import {
  scout, outreach, outreachGeneric, bestSendWindow, type ScoutVendor, type ScoutInput,
} from '@/lib/vendorScout';

export type ScoutEvent = {
  id: string; name: string; date: string | null; venue: string; guests: number | null;
};

/**
 * Five suppliers for one couple, from the producer's own book.
 *
 * The brief that asked for this wanted Instagram and review sites searched.
 * The server cannot do that, and the honest line at the bottom says so.
 * What it does instead is rank the suppliers this producer already trusts,
 * on the brief's own three scores, and write the message, with the
 * couple's facts filled in and one bracket left for the detail only a
 * person who has looked at the supplier's work can write.
 */
export function VendorScout({ vendors, events, signAs, demo }: {
  vendors: ScoutVendor[]; events: ScoutEvent[]; signAs: string;
  /** The gallery's way in: opened, filled and ranked on arrival. */
  demo?: { style: string; area: string; low: string; high: string; breakers: string };
}) {
  const ui = useCopy();
  const c = ui.vendor.scout;
  const locale = ui.locale;
  const dateFmt = shortDate(locale);
  const [open, setOpen] = useState(!!demo);
  const [category, setCategory] = useState('photo');
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [style, setStyle] = useState(demo?.style ?? '');
  const [area, setArea] = useState(demo?.area ?? '');
  const [low, setLow] = useState(demo?.low ?? '');
  const [high, setHigh] = useState(demo?.high ?? '');
  const [breakers, setBreakers] = useState(demo?.breakers ?? '');
  const [ran, setRan] = useState<ScoutInput | null>(demo ? {
    category: 'photo', style: demo.style, area: demo.area, dealBreakers: demo.breakers,
    budgetLow: demo.low ? Number(demo.low) : null, budgetHigh: demo.high ? Number(demo.high) : null,
  } : null);
  const [copied, setCopied] = useState<'one' | 'rest' | null>(null);

  const event = events.find((e) => e.id === eventId) ?? null;
  const results = useMemo(() => (ran ? scout(vendors, ran) : []), [vendors, ran]);
  const window = bestSendWindow(todayInZone());

  const run = () => setRan({
    category, style, area, dealBreakers: breakers,
    budgetLow: low.trim() ? Number(low) : null,
    budgetHigh: high.trim() ? Number(high) : null,
  });

  const base = {
    couple: event?.name ?? '',
    date: event?.date ? dateFmt.format(new Date(`${event.date}T12:00:00Z`)) : '',
    venue: event?.venue ?? '',
    guests: event?.guests ?? null,
    budgetLow: ran?.budgetLow ?? null,
    budgetHigh: ran?.budgetHigh ?? null,
    signAs,
    category: categoryLabelFor(category, locale),
  };
  const first = results[0];
  const textOne = first ? outreach({ ...base, vendorName: first.vendor.name, contactName: first.vendor.contact_name }) : '';
  const textRest = outreachGeneric(base);

  const copy = async (which: 'one' | 'rest', text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(null), 1500); } catch { /* on screen anyway */ }
  };
  const wa = (phone: string, text: string) =>
    `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(text)}`;

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl2 border border-line-strong bg-card px-4 py-2.5 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
      >
        <Radar size={16} aria-hidden strokeWidth={1.5} />
        {c.open}
      </button>
    );
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setOpen(false)}>{c.close}</button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-[12.5px] text-ink-mute">
          {c.category}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1 w-full">
            {vendorCategoriesFor(locale).map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="text-[12.5px] text-ink-mute">
          {c.event}
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="field mt-1 w-full">
            <option value="">{c.noEvent}</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="text-[12.5px] text-ink-mute">
          {c.area}
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder={c.areaPh} className="field mt-1 w-full" />
        </label>
        <label className="text-[12.5px] text-ink-mute sm:col-span-2">
          {c.style}
          <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder={c.stylePh} className="field mt-1 w-full" />
        </label>
        <div className="text-[12.5px] text-ink-mute">
          {c.budget}
          <div className="mt-1 flex gap-2">
            <input type="number" inputMode="numeric" min={0} value={low} onChange={(e) => setLow(e.target.value)} placeholder={c.low} aria-label={c.low} className="field w-full" />
            <input type="number" inputMode="numeric" min={0} value={high} onChange={(e) => setHigh(e.target.value)} placeholder={c.high} aria-label={c.high} className="field w-full" />
          </div>
        </div>
        <label className="text-[12.5px] text-ink-mute sm:col-span-2 lg:col-span-3">
          {c.dealBreakers}
          <input value={breakers} onChange={(e) => setBreakers(e.target.value)} placeholder={c.dealBreakersPh} className="field mt-1 w-full" />
        </label>
      </div>
      <div className="mt-4">
        <button type="button" onClick={run} className="btn-primary">{c.run}</button>
      </div>

      {ran && results.length === 0 && (
        <p className="mt-5 rounded-xl2 bg-surface-200 px-4 py-3 text-[14px] text-ink-soft">{c.none}</p>
      )}

      {results.length > 0 && (
        <>
          <ol className="mt-6 space-y-3">
            {results.map((r, i) => (
              <li key={r.vendor.id} className="rounded-xl2 border border-line px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15.5px] font-semibold text-ink">
                      <span className="me-2 text-ink-mute">{i + 1}.</span>{r.vendor.name}
                      {r.areaMatch && <span className="ms-2 rounded-xl2 bg-ok-wash px-2 py-0.5 text-[11.5px] text-ok">{c.inArea}</span>}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-mute">
                      {categoryLabelFor(r.vendor.category, locale)}
                      {r.vendor.area ? ` · ${r.vendor.area}` : ''}
                      {r.vendor.contact_name ? ` · ${r.vendor.contact_name}` : ''}
                    </p>
                  </div>
                  <p className="font-display text-[22px] font-semibold tabular-nums text-ink">
                    {r.total}<span className="ms-1 text-[12px] font-normal text-ink-mute">{c.outOf}</span>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-soft">
                  <span>{c.colStyle} <b className="tabular-nums text-ink">{r.style}</b></span>
                  <span>{c.colBudget} <b className="tabular-nums text-ink">{r.budget}</b></span>
                  <span>{c.colStrength} <b className="tabular-nums text-ink">{r.strength}</b></span>
                  <span>{r.vendor.agreed_price !== null ? <Money value={r.vendor.agreed_price} /> : c.noPrice}</span>
                  <span>{r.vendor.bookings > 0 ? plural(c.bookings, r.vendor.bookings) : c.neverBooked}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-ink-soft">
                  {r.matched.length > 0 ? fill(c.why, { words: r.matched.join(', ') }) : c.whyNone}
                </p>
                {r.flags.length > 0 && (
                  <p className="mt-1 text-[13px] font-medium text-bad">{fill(c.flags, { words: r.flags.join(', ') })}</p>
                )}
                {r.vendor.notes && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">{r.vendor.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                  {r.vendor.phone && (
                    <a href={`tel:${r.vendor.phone}`} className="inline-flex items-center gap-1 text-accent"><Phone size={13} aria-hidden strokeWidth={1.5} />{r.vendor.phone}</a>
                  )}
                  {r.vendor.email && <a href={`mailto:${r.vendor.email}`} className="text-accent">{r.vendor.email}</a>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">{c.outreachTitle}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">{c.outreachSub}</p>
              <textarea readOnly value={textOne} rows={10} className="field mt-2 w-full resize-y text-[13.5px] leading-relaxed" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy('one', textOne)} className="btn-ghost text-[13.5px]">
                  {copied === 'one' ? <Check size={14} aria-hidden strokeWidth={1.5} /> : <Copy size={14} aria-hidden strokeWidth={1.5} />}
                  {copied === 'one' ? c.copied : c.copy}
                </button>
                {first?.vendor.phone && (
                  <a href={wa(first.vendor.phone, textOne)} target="_blank" rel="noreferrer" className="btn-ghost text-[13.5px]">
                    <MessageCircle size={14} aria-hidden strokeWidth={1.5} />{c.whatsapp}
                  </a>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-ink">{c.genericTitle}</h3>
              <textarea readOnly value={textRest} rows={10} className="field mt-2 w-full resize-y text-[13.5px] leading-relaxed" />
              <div className="mt-2">
                <button type="button" onClick={() => copy('rest', textRest)} className="btn-ghost text-[13.5px]">
                  {copied === 'rest' ? <Check size={14} aria-hidden strokeWidth={1.5} /> : <Copy size={14} aria-hidden strokeWidth={1.5} />}
                  {copied === 'rest' ? c.copied : c.copy}
                </button>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[13.5px] text-ink-soft">
            {window.now
              ? c.bestWeekNow
              : fill(c.bestWeekNext, {
                  from: dateFmt.format(new Date(`${window.from}T12:00:00Z`)),
                  to: dateFmt.format(new Date(`${window.to}T12:00:00Z`)),
                })}
          </p>
        </>
      )}

      <p className="mt-4 text-[12.5px] text-ink-mute">{c.honest}</p>
    </section>
  );
}
