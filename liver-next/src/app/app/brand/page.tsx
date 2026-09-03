import { requireLiveProducer } from '@/lib/auth';
import { appCopy } from '@/content/site';
import { platformRoot } from '@/lib/tenant';
import { PageHead } from '@/components/app/PageHead';
import { BrandEditor } from '@/components/app/BrandEditor';
import { ProducerLinkCard } from '@/components/app/ProducerLinkCard';
import { BrandAssets } from '@/components/app/BrandAssets';

export const dynamic = 'force-dynamic';
export const metadata = { title: appCopy.brand.title };

export default async function BrandPage() {
  const account = await requireLiveProducer();
  const p = account.producer;

  return (
    <>
      <PageHead title={appCopy.brand.title} sub={appCopy.brand.sub} />
      {/* First on the screen, above the editor: the reason most producers
          open this page after the first week is to get the link they send. */}
      <div className="mb-6 space-y-6">
        <ProducerLinkCard slug={p?.slug ?? null} />
        {/* The pictures, before the words: the logo is the first thing a new
            producer looks for on this screen, and it was the one thing the
            screen could not take. */}
        <BrandAssets urls={{ logo: p?.logoUrl ?? null, icon: p?.iconUrl ?? null, cover: p?.coverUrl ?? null }} />
      </div>
      <BrandEditor
        rootDomain={platformRoot()}
        fields={{
          brandName: p?.brandName ?? '',
          tagline: p?.tagline ?? '',
          accent: p?.accent ?? 'slate',
          whatsapp: p?.whatsapp ?? '',
          bookingUrl: '',
          slug: p?.slug ?? null,
          domain: p?.domain ?? null,
          logoUrl: p?.logoUrl ?? null,
        }}
      />
    </>
  );
}
