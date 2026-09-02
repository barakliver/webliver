'use client';

import { CalendarHeart, Mail, X } from 'lucide-react';
import Link from 'next/link';
import { cancelAnniversary } from '@/app/actions/archive';
import { archiveCopy as c } from '@/content/site';
import { Ltr } from '@/components/Ltr';

export type Anniversary = {
  id: string;
  clientId: string;
  milestone: 'month' | 'week' | 'day';
  dueOn: string;
  eventDate: string;
  couple: string;
  daysAway: number;
  emails: string[];
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The first anniversary, on the screen a producer opens in the morning.
 *
 * One row per event rather than one per reminder: three are scheduled and only
 * the nearest unsent one is news. Showing all three would put the same wedding
 * on the page three times, for dates months apart, which reads as three events
 * rather than one with a schedule behind it.
 *
 * The greeting is a draft in their own mail client, not something this app
 * sends. A message that arrives a year after the wedding is worth a producer's
 * own sentence, and an automatic one signed with their name that they never
 * read is worse than nothing.
 */
export function Anniversaries({ items }: { items: Anniversary[] }) {
  if (items.length === 0) return null;

  return (
    <section className="card" aria-labelledby="anniv">
      <div className="flex items-center gap-2 text-accent">
        <CalendarHeart size={16} strokeWidth={1.5} aria-hidden />
        <h2 id="anniv" className="eyebrow">{c.anniversary}</h2>
      </div>
      <p className="mt-2 text-[13px] text-ink-mute">{c.anniversarySub}</p>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <Link href={`/app/clients/${a.clientId}`} className="min-w-0 flex-1 text-start">
              <p className="truncate text-[15px] text-ink">{a.couple}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-mute">
                {/* The date is the wedding's, not the reminder's. Without
                    saying so, "tomorrow · 2 September 2025" reads as a wedding
                    happening tomorrow in a year that has passed. */}
                {when(a)} · {c.yearSince}{dateFmt.format(new Date(a.eventDate))}
              </p>
            </Link>

            <span className="flex shrink-0 items-center gap-1">
              {a.emails.length > 0 && (
                <a
                  href={greeting(a)}
                  className="btn-quiet inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[13px] sm:min-h-0 sm:py-1"
                >
                  <Mail size={14} aria-hidden strokeWidth={1.5} />
                  {c.greet}
                </a>
              )}
              <form action={cancelAnniversary}>
                <input type="hidden" name="id" value={a.id} />
                {/* 44px on a phone, back to quiet on a pointer. A dismiss the
                    size of its glyph is a dismiss that cancels the row above. */}
                <button
                  type="submit"
                  className="btn-quiet grid size-11 place-items-center p-0 sm:size-8"
                  aria-label={c.anniversaryCancel}
                >
                  <X size={14} aria-hidden strokeWidth={1.5} />
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How far off, said the way a person says it. A day that has already passed
 *  is stated plainly rather than hidden: it is the one state that means the
 *  nightly sweep has not run, and hiding it would hide the fault. */
function when(a: Anniversary): string {
  if (a.daysAway < 0) return 'עבר';
  if (a.daysAway === 0) return 'היום';
  if (a.daysAway === 1) return c.anniversaryIn.day;
  if (a.daysAway <= 8) return c.anniversaryIn.week;
  return c.anniversaryIn.month;
}

/** A draft in the producer's own mail client, addressed to the couple. */
function greeting(a: Anniversary): string {
  const subject = 'שנה לחתונה שלכם';
  const body = [
    `${a.couple},`,
    '',
    `היום לפני שנה, ב-${dateFmt.format(new Date(a.eventDate))}, התחתנתם.`,
    '',
    'מזל טוב, ושתהיה לכם שנה טובה.',
    '',
  ].join('\n');

  return `mailto:${a.emails.join(',')}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;
}
