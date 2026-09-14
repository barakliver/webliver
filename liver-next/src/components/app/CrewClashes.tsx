'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { EVENT_ZONE } from '@/lib/clock';

export type ClashRow = {
  memberId: string;
  name: string;
  date: string;
  events: { id: string; name: string }[];
};

/**
 * The same person, twice on one night.
 *
 * This is the one mistake the season board exists to catch and the one nothing
 * in this product could ever see: each of the two evenings is perfectly
 * staffed on its own, and the clash lives only in the pair. Nobody finds out
 * until one of the two weddings is a manager short at four in the afternoon.
 *
 * So it sits at the top of the screen rather than as a mark somewhere in the
 * list, it names both events, and both are links — the fix is always to open
 * one of them and take somebody off. It disappears the moment that is done,
 * which is the only dismissal it should have: a warning with a close button is
 * a warning that gets closed.
 */
export function CrewClashes({ rows }: { rows: ClashRow[] }) {
  const c = useCopy().crew;
  const locale = useCopy().locale;
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long',
  });

  if (rows.length === 0) return null;

  return (
    <section
      role="alert"
      aria-labelledby="crew-clashes"
      className="rounded-card border border-bad/30 bg-bad-wash p-4 sm:p-5"
    >
      <h3 id="crew-clashes" className="flex items-center gap-2 font-display text-[16px] font-semibold text-bad">
        <TriangleAlert size={17} aria-hidden strokeWidth={1.5} />
        {rows.length === 1 ? c.clashOne : c.clashMany}
      </h3>

      <ul className="mt-2.5 list-none space-y-2 p-0">
        {rows.map((r) => (
          <li key={`${r.memberId}-${r.date}`} className="text-[14px] text-ink">
            <b className="font-semibold">{r.name}</b>
            {' · '}
            {fmt.format(new Date(r.date))}
            <span className="mt-0.5 block text-[13.5px] text-ink-soft">
              {r.events.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ' · '}
                  <Link
                    href={`/app/clients/${e.id}`}
                    className="underline underline-offset-4 transition-colors hover:text-accent"
                  >
                    {e.name}
                  </Link>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
