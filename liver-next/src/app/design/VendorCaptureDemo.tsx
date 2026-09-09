'use client';

import { VendorCaptureModal } from '@/components/portal/VendorCaptureModal';

/** The supplier form, held open so it can be looked at.
 *
 *  A client component rather than markup in the page, because the modal takes
 *  onClose and onSaved, and a function cannot cross from a server component to
 *  a client one — which is not a theoretical rule here: the event selector
 *  shipped once with a no-op handler passed exactly that way, and the portal
 *  threw on render. The gallery is a server component, so the handlers are
 *  made here, on the client side of the line.
 *
 *  Nothing is wired up. Saving would write a supplier to a database this page
 *  does not have, and the point of the panel is the form: which fields the
 *  template asks for, how the Hebrew sits in them, and what the two buttons
 *  look like next to each other. */
export function VendorCaptureDemo() {
  return (
    <VendorCaptureModal
      eventId="00000000-0000-4000-8000-000000000001"
      task={{
        id: '00000000-0000-4000-8000-000000000002',
        client_id: '00000000-0000-4000-8000-000000000003',
        event_id: '00000000-0000-4000-8000-000000000001',
        title: 'בחר אולם',
        due_on: null,
        done: false,
        owner: 'client',
        created_by: null,
        created_at: '2026-01-01T00:00:00.000Z',
        category: 'venue',
        vendor_id: null,
      }}
      template={{
        id: '00000000-0000-4000-8000-000000000004',
        event_type: 'wedding',
        title: 'בחר אולם',
        description: 'אולם או גן לחתונה',
        is_vendor_task: true,
        vendor_category: 'venue',
        ask_name: true,
        ask_cost: true,
        ask_phone: true,
        ask_contact_name: false,
        ask_location: false,
        ask_notes: true,
        sort_order: 10,
        created_at: '2026-01-01T00:00:00.000Z',
      }}
      onClose={() => {}}
      onSaved={() => {}}
    />
  );
}
