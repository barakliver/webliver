'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, MessageCircle, PenLine } from 'lucide-react';
import { site } from '@/content/site';
import { publicEnv } from '@/lib/env';
import { LeadForm } from './LeadForm';

type Sheet = null | 'lead';

/** A single fixed dock owns every floating action, so nothing can drift on top
 *  of anything else: the three actions are laid out by one flex container
 *  rather than each positioning itself independently. */
export function FabDock() {
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sheet]);

  const wa = publicEnv.whatsapp
    ? `https://wa.me/${publicEnv.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(site.fab.whatsappMessage)}`
    : null;

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:px-0"
        role="group" aria-label="פעולות מהירות"
      >
        <div className="flex w-full max-w-md items-center gap-2 rounded-none glass-strong p-1.5 shadow-dock sm:w-auto">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer"
               /* WhatsApp's own green was the one colour on this page that
                  belonged to somebody else. On a warm ivory palette it reads
                  as a banner ad rather than as a way to reach a producer, and
                  it was the brightest thing on a screen whose whole argument
                  is restraint. The icon still says which app it opens. */
               className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-none bg-ink px-4 text-[14px] tracking-[.03em] text-surface transition-colors duration-300 hover:bg-ink-soft sm:flex-none">
              <MessageCircle size={17} aria-hidden strokeWidth={1.5} /><span>{site.fab.whatsapp}</span>
            </a>
          )}
          {/* Booking is a link, not a sheet. It used to open the calendar in an
              iframe, which can never work: Google serves the booking page with
              frame-ancestors set, so the panel would have come up empty. It
              also puts the couple one tap from a slot instead of three. */}
          {publicEnv.bookingUrl ? (
            <a href={publicEnv.bookingUrl} target="_blank" rel="noopener noreferrer"
               title={site.fab.bookingNote}
               className="flex flex-1 items-center justify-center gap-2 rounded-none bg-ink px-4 py-2.5 text-[14px] font-medium text-surface transition hover:bg-ink-soft sm:flex-none">
              <CalendarDays size={17} aria-hidden strokeWidth={1.5} /><span>{site.fab.booking}</span>
            </a>
          ) : null}
          <button type="button" onClick={() => setSheet('lead')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-none border border-line-strong bg-card/80 px-4 py-2.5 text-[14px] font-medium text-ink transition hover:bg-card sm:flex-none">
            <PenLine size={17} aria-hidden strokeWidth={1.5} /><span>{site.fab.lead}</span>
          </button>
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-sm sm:items-center"
             onMouseDown={e => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div role="dialog" aria-modal="true" aria-label={site.fab.lead}
               className="max-h-[88svh] w-full max-w-lg animate-sheet overflow-y-auto rounded-t-4xl glass-strong p-6 sm:rounded-none sm:p-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-title font-light text-ink">{site.lead.title}</h2>
              <button type="button" onClick={() => setSheet(null)} aria-label="סגירה"
                      className="rounded-none p-2 text-ink-mute transition hover:bg-card hover:text-ink">✕</button>
            </div>
            <LeadForm compact />
          </div>
        </div>
      )}
    </>
  );
}
