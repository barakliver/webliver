import { Navigation, MapPin } from 'lucide-react';

/**
 * The way to the hall, from whichever screen is open.
 *
 * It existed on the guests' page and nowhere else, which is the wrong way
 * round: a guest looks up the address once, at home, the week before. The
 * producer looks it up standing in a car park at six in the evening with a
 * van behind him, and he was the one retyping it into another app.
 *
 * Both of them, because in Israel the answer is Waze for most people and
 * Maps for the rest, and guessing wrong costs the press. `q` is the venue
 * as written, encoded: these are search links rather than coordinates, which
 * is the only thing that works when the field holds "אחוזת הכפר" and not a
 * street address.
 *
 * One component rather than two, because the guests' page already proved
 * this is worth having and a second copy is how the two drift into offering
 * different apps.
 */
export function VenueLinks({ venue, labels, tone = 'quiet', className = '' }: {
  venue: string;
  labels: { waze: string; maps: string };
  /** `quiet` inside the console, `ghost` on a brand surface. */
  tone?: 'quiet' | 'ghost';
  className?: string;
}) {
  const place = venue.trim();
  if (!place) return null;
  const q = encodeURIComponent(place);
  const cls = tone === 'ghost' ? 'btn-ghost' : 'btn-quiet inline-flex min-h-[44px] items-center gap-1.5 px-2 text-body sm:min-h-0';

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <a href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank" rel="noopener noreferrer" className={cls}>
        <Navigation size={15} strokeWidth={1.5} aria-hidden />
        {labels.waze}
      </a>
      <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer" className={cls}>
        <MapPin size={15} strokeWidth={1.5} aria-hidden />
        {labels.maps}
      </a>
    </span>
  );
}
