'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, MapPin, Users } from 'lucide-react';
import type { Shelf, ArchivedEvent } from '@/lib/archive';
import { archiveCopy as c } from '@/content/site';
import { Money, Ltr } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE,
  day: 'numeric', month: 'long', year: 'numeric',
});

/**
 * The shelf.
 *
 * Years are the folders and they open and close. The newest opens on arrival
 * and the rest do not, because the shelf is read from the top and a page that
 * unfolds nine years at once is a page you scroll past rather than read.
 *
 * A closed event is not a link to a live screen dressed up as history: the
 * frozen supplier sheet is right here, one press away, because looking it up
 * is the entire reason somebody came.
 */
export function ArchiveShelf({ shelf }: { shelf: Shelf[] }) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(shelf.length ? [String(shelf[0].year ?? 'none')] : [])
  );

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="space-y-4">
      {shelf.map((folder) => {
        const key = String(folder.year ?? 'none');
        const on = open.has(key);
        return (
          <section key={key} className="card p-0">
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={on}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
            >
              <span className="font-display text-[20px] font-semibold text-ink">
                {folder.year ? c.yearLabel(folder.year) : c.noYear}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[13.5px] text-ink-mute">{c.count(folder.events.length)}</span>
                <ChevronDown
                  size={17} aria-hidden strokeWidth={1.5}
                  className={`text-ink-mute transition-transform ${on ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            {on && (
              <ul className="border-t border-line">
                {folder.events.map((e) => <Row key={e.client_id} event={e} />)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({ event: e }: { event: ArchivedEvent }) {
  const [open, setOpen] = useState(false);
  const budget = Number(e.money?.budget) || 0;
  const paid = Number(e.money?.paid) || 0;

  return (
    <li className="border-b border-line last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-start" aria-expanded={open}>
          <p className="text-[15.5px] text-ink">{e.display_name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-mute">
            {e.event_date && dateFmt.format(new Date(e.event_date))}
            {e.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden strokeWidth={1.5} />
                {e.venue}
              </span>
            )}
            {e.guests_final ? (
              <span className="inline-flex items-center gap-1">
                <Users size={13} aria-hidden strokeWidth={1.5} />
                <Ltr>{e.guests_final}</Ltr>
              </span>
            ) : null}
          </p>
        </button>

        <Link
          href={`/app/clients/${e.client_id}`}
          className="btn-quiet shrink-0 px-3 text-[13.5px]"
        >
          {c.open}
        </Link>
      </div>

      {open && (
        <div className="border-t border-line bg-surface-100 px-5 py-4">
          <p className="text-[11.5px] tracking-[.14em] text-ink-mute">{c.frozen}</p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Block title={c.vendors} rows={e.vendors.map((v) =>
              [v.name ?? '', [v.category, v.phone].filter(Boolean).join(' · ')] as const)} />
            <Block title={c.crew} rows={e.crew.map((k) =>
              [k.name ?? '', [k.role, k.phone].filter(Boolean).join(' · ')] as const)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-[13.5px]">
            <span className="text-ink-mute">{c.budget} <Money value={budget} className="text-ink" /></span>
            <span className="text-ink-mute">{c.paid} <Money value={paid} className="text-ink" /></span>
            <span className="text-ink-mute">
              {c.closedOn} {dateFmt.format(new Date(e.closed_at))}
            </span>
          </div>

          {e.note && <p className="mt-3 whitespace-pre-line text-[14px] text-ink-soft">{e.note}</p>}
        </div>
      )}
    </li>
  );
}

/** A frozen list. An empty one is left out rather than printed with a dash:
 *  an event that had no crew is not the same as an event whose crew was lost,
 *  and a row of dashes reads like the second. */
function Block({ title, rows }: { title: string; rows: readonly (readonly [string, string])[] }) {
  const real = rows.filter(([name]) => name.trim() !== '');
  if (real.length === 0) return null;

  return (
    <div>
      <p className="text-[13px] text-accent">{title}</p>
      <ul className="mt-2 space-y-1">
        {real.map(([name, meta], i) => (
          <li key={`${name}-${i}`} className="text-[14px] text-ink">
            {name}
            {meta && <span className="text-ink-mute"> · {meta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
