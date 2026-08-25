import { CalendarDays } from 'lucide-react';
import { site } from '@/content/site';
import { publicEnv } from '@/lib/env';

/** The meeting is booked in Barak's own calendar, so this is a link out and
 *  not a form we then have to answer. Rendering nothing when no calendar is
 *  configured is deliberate: a dead scheduling button is worse than none. */
export function BookMeeting({ className = 'btn-primary' }: { className?: string }) {
  if (!publicEnv.bookingUrl) return null;
  return (
    <a href={publicEnv.bookingUrl} target="_blank" rel="noopener noreferrer" className={className}>
      <CalendarDays size={17} aria-hidden strokeWidth={1.5} />
      <span>{site.closing.cta}</span>
    </a>
  );
}
