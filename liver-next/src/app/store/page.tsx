import { cookies } from 'next/headers';
import { LOCALE_COOKIE, readLocale } from '@/lib/locale';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { Nav } from '@/components/marketing/Nav';
import { Section } from '@/components/marketing/Section';
import { PromiseLine } from '@/components/Promise';
import { Shop, type ShopItem } from '@/components/marketing/Shop';
import { storeFor } from '@/content/ui';
import { storeImageUrl } from '@/lib/store';
import { SiteFooter } from '@/components/marketing/SiteFooter';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const c = storeFor(readLocale((await cookies()).get(LOCALE_COOKIE)?.value));
  return { title: c.shopTitle, alternates: { canonical: '/store' } };
}

type Row = {
  id: string; name: string; blurb: string; body: string;
  price: number; kind: 'product' | 'service'; image_path: string;
};

/**
 * The shop, on the public site.
 *
 * Read with the anonymous client, which is exactly the right to a visitor has
 * anyway: the products policy shows a stranger only what is switched on, so
 * the filter that matters is in the database rather than in this query. A
 * draft package is not merely hidden here, it is unreachable.
 */
export default async function StorePage() {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const sb = supabasePublic();
  const site = await getSiteCopy(sb, locale);
  const c = storeFor(locale);

  const { data: producerId } = await sb.rpc('public_site_producer');

  let items: ShopItem[] = [];
  if (producerId) {
    const { data } = await sb
      .from('products')
      .select('id,name,blurb,body,price,kind,image_path')
      .eq('producer_id', producerId)
      .eq('active', true)
      .order('sort_order')
      .order('created_at');

    items = ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      blurb: r.blurb,
      body: r.body,
      price: Number(r.price) || 0,
      kind: r.kind === 'service' ? 'service' : 'product',
      image: storeImageUrl(r.image_path),
    }));
  }

  return (
    <>
      <Nav site={site} locale={locale} shop={items.length > 0} />
      <main id="main">
        <Section id="shop" title={c.shopTitle} level={1}>
          <p className="mb-8 text-[15.5px] text-ink-soft">{c.shopSub}</p>
          <Shop producerId={String(producerId ?? '')} items={items} copy={c} />
          <PromiseLine className="mt-16" text={site.hero.headline} />
        </Section>

        <SiteFooter brand={site.brand} note={site.footer} locale={locale} />
      </main>
    </>
  );
}
