'use client';

import { useEffect, useRef } from 'react';
import { TimelineBuilder } from '@/components/app/TimelineBuilder';

/** The timeline, opened so it can be looked at.
 *
 *  The component collapses to a button until pressed, which is right on the
 *  event page and useless in a gallery. Pressing it here, once, on mount, is
 *  the whole of this file. Applying would write tasks to a database this
 *  page does not have; the point is the table. */
export function TimelineDemo() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector('button')?.click();
  }, []);
  return (
    <div ref={box}>
      <TimelineBuilder
        clientId="00000000-0000-4000-8000-000000000003"
        eventDate="2027-06-06"
        guestEstimate={180}
      />
    </div>
  );
}
