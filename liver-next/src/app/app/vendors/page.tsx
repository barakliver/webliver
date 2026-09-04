import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { VendorDirectory, type Vendor } from '@/components/app/VendorDirectory';
import { safeRows } from '@/lib/safe';
import { vendorCopy } from '@/content/site';
import { IssueReporter } from '@/components/app/IssueReporter';

export const dynamic = 'force-dynamic';
export const metadata = { title: vendorCopy.dirTitle };

/** The producer's own book of suppliers, which is theirs and not an event's.
 *  Row level security scopes it to the signed-in producer, so there is nothing
 *  to filter here beyond what the screen wants to show. */
export default async function VendorsPage() {
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const vendors = await safeRows<Vendor>('vendors', sb
    .from('vendors')
    .select('id,name,category,contact_name,phone,email,area,notes,archived_at,agreed_price,deposit_paid')
    .order('name'));

  return (
    <>
      <PageHead
        title={vendorCopy.dirTitle} sub={vendorCopy.dirSub}
        report={<IssueReporter userId={account.id} context={vendorCopy.dirTitle} />}
      />
      <VendorDirectory vendors={vendors} />
      <Live sources={[{ table: 'vendors' }]} />
    </>
  );
}
