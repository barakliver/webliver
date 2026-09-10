'use client';

import { VendorScout } from '@/components/app/VendorScout';

/** The scout, opened and ranked on arrival so the ranking and the message
 *  can be looked at. Nothing here reaches a database. */
export function VendorScoutDemo() {
  return (
    <div>
      <VendorScout
        demo={{ style: 'חם, טבעי, לא מבוים', area: 'מרכז', low: '10000', high: '15000', breakers: 'מינימום, פילטרים' }}
        signAs="ברק"
        events={[{ id: 'c1', name: 'לי ורותם', date: '2027-06-06', venue: 'שדה חמד', guests: 180 }]}
        vendors={[
          { id: '1', name: 'סטודיו לביא', category: 'photo', contact_name: 'נועה', phone: '0521234567', email: 'noa@lavi.co.il', area: 'מרכז', notes: 'צילום חם וטבעי, לא מבוים, עריכה נקייה', agreed_price: 13500, bookings: 4 },
          { id: '2', name: 'רון צלמים', category: 'photo', contact_name: '', phone: '0501111111', email: '', area: 'צפון', notes: 'מינימום 8 שעות. סגנון מגזיני', agreed_price: 18000, bookings: 1 },
          { id: '3', name: 'עדי פריים', category: 'photo', contact_name: 'עדי', phone: '', email: 'adi@frame.co.il', area: 'מרכז', notes: '', agreed_price: null, bookings: 0 },
          { id: '4', name: 'להקת שדות', category: 'music', contact_name: '', phone: '', email: '', area: '', notes: 'חם', agreed_price: 9000, bookings: 6 },
          { id: '5', name: 'מיכל אור', category: 'photo', contact_name: 'מיכל', phone: '0539999999', email: '', area: 'ירושלים', notes: 'טבעי, אור יום, זוגות דתיים', agreed_price: 11000, bookings: 2 },
          { id: '6', name: 'בן פוטו', category: 'photo', contact_name: '', phone: '', email: '', area: '', notes: 'פילטרים כבדים', agreed_price: 7000, bookings: 0 },
        ]}
      />
    </div>
  );
}
