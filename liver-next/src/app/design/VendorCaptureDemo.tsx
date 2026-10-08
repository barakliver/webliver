'use client';

import { useState } from 'react';
import { VendorCaptureModal } from '@/components/portal/VendorCaptureModal';

/** The supplier form, opened the way the product opens it.
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
 *  look like next to each other.
 *
 *  It used to be held open, which was simpler and stopped being possible the
 *  day the modal learned to hold the page still underneath it: a dialog
 *  mounted open for the whole of this page meant this page could not scroll.
 *  Behind a button it is also the more truthful harness, because opening and
 *  closing is now part of what there is to look at. */
export function VendorCaptureDemo() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-body">
        פתיחת הטופס
      </button>
    );
  }
  return (
    <VendorCaptureModal
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
      onClose={() => setOpen(false)}
      onSaved={() => {}}
      onSkip={() => setOpen(false)}
    />
  );
}
