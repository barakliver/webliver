import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { VendorDirectory, type Vendor } from '@/components/app/VendorDirectory';
import { VendorScout } from '@/components/app/VendorScout';
import { safeRows } from '@/lib/safe';
import { serverCopy } from '@/lib/serverLocale';
import { IssueReporter } from '@/components/app/IssueReporter';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).vendor.dirTitle };
}

/** The producer's own book of suppliers, which is theirs and not an event's.
 *  Row level security scopes it to the signed-in producer, so there is nothing
 *  to filter here beyond what the screen wants to show. */
export default async function VendorsPage() {
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const vendors = await safeRows<Vendor>('vendors', sb
    .from('vendors')
    .select('id,name,category,contact_name,phone,email,area,notes,archived_at,agreed_price,deposit_paid')
    .order('name'));

  /* For the scout: the open events, and how often each supplier has been
     on one of this producer's events, counted by name because the event
     file's row does not point back at the directory. */
  const [clients, booked] = await Promise.all([
    safeRows<{ id: string; display_name: string; event_date: string | null; venue: string | null; guest_estimate: number | null }>(
      'events', sb.from('clients').select('id,display_name,event_date,venue,guest_estimate').is('archived_at', null)
        .order('event_date', { ascending: true, nullsFirst: false })),
    safeRows<{ name: string }>('bookings', sb.from('event_vendors').select('name')),
  ]);
  const bookings = new Map<string, number>();
  for (const b of booked) bookings.set(b.name.trim().toLowerCase(), (bookings.get(b.name.trim().toLowerCase()) ?? 0) + 1);
  const scoutVendors = vendors.filter((v) => !v.archived_at).map((v) => ({
    id: v.id, name: v.name, category: v.category, contact_name: v.contact_name, phone: v.phone, email: v.email,
    area: v.area, notes: v.notes, agreed_price: v.agreed_price === null ? null : Number(v.agreed_price),
    bookings: bookings.get(v.name.trim().toLowerCase()) ?? 0,
  }));
  const scoutEvents = clients.map((c) => ({
    id: c.id, name: c.display_name, date: c.event_date, venue: c.venue ?? '', guests: c.guest_estimate,
  }));

  return (
    <>
      <PageHead
        title={ui.vendor.dirTitle} sub={ui.vendor.dirSub}
        report={<IssueReporter userId={account.id} context={ui.vendor.dirTitle} />}
      />
      <div className="mb-6">
        <VendorScout vendors={scoutVendors} events={scoutEvents} signAs={account.producer?.brandName || account.fullName || ''} />
      </div>
      <VendorDirectory vendors={vendors} />
      <Live sources={[{ table: 'vendors' }]} />
    </>
  );
}
