'use client';

import { TimelineBuilder } from '@/components/app/TimelineBuilder';

/** The timeline, opened so it can be looked at: the component collapses to
 *  a button on the event page, which is right there and useless here.
 *  Applying would write tasks to a database this page does not have; the
 *  point is the table. */
export function TimelineDemo() {
  return (
    <TimelineBuilder
      clientId="00000000-0000-4000-8000-000000000003"
      defaultOpen
      eventDate="2027-06-06"
      guestEstimate={180}
    />
  );
}
