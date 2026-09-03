import { CalendarPlus, MapPin, Navigation } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import type { GuestSiteCopy } from '@/content/ui';
import { weekdayDate } from '@/lib/appDates';
import { formatDate, daysUntil } from '@/lib/dates';
import { hhmm } from '@/lib/runsheet';
import { Ltr } from '@/components/Ltr';
import { FindInvite } from './FindInvite';

export type GuestSite = {
  event_name: string;
  event_date: string | null;
  venue: string | null;
  note: string;
  producer: string;
  moments: { at: string; title: string }[];
};

/**
 * The guests' page, pure of any data source.
 *
 * Read on a phone, from a family group, by somebody who will spend forty
 * seconds on it. So it answers in the order they ask: whose, when, where,
 * how do I get there, what happens, and how do I say I am coming. One column,
 * the names in the serif, the countdown as the one large number, and every
 * action a real button that opens the app they already have - Waze, Maps,
 * the calendar. Nothing to learn.
 *
 * The producer's brand signs the foot of the page, small. Guests are the
 * one audience that meets the production without ever meeting the platform,
 * and a white label is precisely a page like this.
 */
export function GuestSiteView({ site, token, c, locale }: {
  site: GuestSite; token: string; c: GuestSiteCopy; locale: Locale;
}) {
  const left = daysUntil(site.event_date);
  const dateFmt = weekdayDate(locale);
  const venue = site.venue?.trim() ?? '';
  const q = encodeURIComponent(venue);

  return (
    <main id="main" className="min-h-dvh bg-surface px-5 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-xl">
        <header className="text-center">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="mt-4 font-display text-display-xl font-semibold leading-tight text-ink">
            {site.event_name}
          </h1>
          <p className="mt-5 text-[16.5px] text-ink-soft">
            {formatDate(dateFmt, site.event_date, c.dateTbd)}
          </p>
          {venue && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-ink-mute">
              <MapPin size={15} strokeWidth={1.5} aria-hidden />
              {venue}
            </p>
          )}

          {left !== null && (
            <div className="mt-9">
              {left > 0 ? (
                <>
                  <p className="font-display text-[88px] font-semibold leading-none text-ink sm:text-[112px]">
                    <Ltr>{left.toLocaleString('en-US')}</Ltr>
                  </p>
                  <p className="mt-2 text-[14px] tracking-[.06em] text-ink-mute">{c.daysLeft}</p>
                </>
              ) : left === 0 ? (
                <p className="font-display text-[40px] font-semibold leading-none text-accent-bright">{c.today}</p>
              ) : (
                <p className="text-[15.5px] text-ink-soft">{c.passed}</p>
              )}
            </div>
          )}

          <hr className="rule-gold mx-auto mt-10 w-24" />
        </header>

        {/* ── the three buttons ─────────────────────────────────────────── */}
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {venue && (
            <>
              <a
                href={`https://waze.com/ul?q=${q}&navigate=yes`}
                target="_blank" rel="noopener noreferrer"
                className="btn-ghost"
              >
                <Navigation size={16} strokeWidth={1.5} aria-hidden />
                {c.waze}
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${q}`}
                target="_blank" rel="noopener noreferrer"
                className="btn-ghost"
              >
                <MapPin size={16} strokeWidth={1.5} aria-hidden />
                {c.maps}
              </a>
            </>
          )}
          {site.event_date && (
            <a href={`/w/${token}/event.ics`} className="btn-ghost">
              <CalendarPlus size={16} strokeWidth={1.5} aria-hidden />
              {c.calendar}
            </a>
          )}
        </div>

        {/* ── the evening ───────────────────────────────────────────────── */}
        {site.moments.length > 0 && (
          <section className="mt-12">
            <h2 className="eyebrow text-center">{c.moments}</h2>
            <ul className="mx-auto mt-5 max-w-sm list-none divide-y divide-line border-y border-line p-0">
              {site.moments.map((m, i) => (
                <li key={i} className="flex items-baseline gap-5 py-3 text-[16px]">
                  <span className="w-[52px] shrink-0 font-display text-[18px] font-semibold tabular-nums text-ink" dir="ltr">
                    {hhmm(m.at)}
                  </span>
                  <span className="text-ink">{m.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── a few words ───────────────────────────────────────────────── */}
        {site.note.trim() && (
          <section className="mt-12">
            <h2 className="eyebrow text-center">{c.note}</h2>
            <p className="measure mx-auto mt-4 whitespace-pre-line text-center text-[16.5px] leading-relaxed text-ink-soft">
              {site.note}
            </p>
          </section>
        )}

        {/* ── the reply ─────────────────────────────────────────────────── */}
        <section className="card mt-12">
          <h2 className="font-display text-[22px] font-semibold text-ink">{c.rsvpTitle}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{c.rsvpSub}</p>
          <div className="mt-5">
            <FindInvite
              token={token}
              c={{ phone: c.phone, find: c.find, finding: c.finding, notFound: c.notFound, tooMany: c.tooMany, bad: c.bad }}
            />
          </div>
        </section>

        {site.producer && (
          <footer className="mt-14 text-center text-[12.5px] text-ink-mute">
            {c.producedBy} · {site.producer}
          </footer>
        )}
      </div>
    </main>
  );
}
