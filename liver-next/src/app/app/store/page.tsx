import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { Live } from '@/components/app/Live';
import { safeRows } from '@/lib/safe';
import { StoreProducts, type Product } from '@/components/app/StoreProducts';
import { OrdersBoard, type Order } from '@/components/app/OrdersBoard';
import { storeCopy } from '@/content/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: storeCopy.title };

/** What this producer sells, and what has been ordered.
 *
 *  Both halves are theirs alone: row level security scopes products and orders
 *  to the producer who owns them, so there is nothing to filter here beyond
 *  the order the screen wants to draw them in. */
export default async function StorePage() {
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const [products, orders] = await Promise.all([
    safeRows<Product>('products', sb
      .from('products')
      .select('id,name,blurb,body,price,kind,image_path,active')
      .order('sort_order').order('created_at')),
    safeRows<Order>('orders', sb
      .from('orders')
      .select('id,number,buyer_name,buyer_phone,buyer_email,items,total,status,note,created_at')
      .order('created_at', { ascending: false })
      .limit(200)),
  ]);

  return (
    <>
      <PageHead title={storeCopy.title} sub={storeCopy.sub}
        report={<IssueReporter userId={account.id} context={storeCopy.title} />}
      />
      <div className="space-y-6">
        <StoreProducts
          producerId={account.producer?.id ?? ''}
          products={products}
        />
        <OrdersBoard orders={orders} />
      </div>
      <Live sources={[{ table: 'products' }, { table: 'orders' }]} />
    </>
  );
}
