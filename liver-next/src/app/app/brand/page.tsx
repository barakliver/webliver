import { requireLiveProducer } from '@/lib/auth';
import { appCopy } from '@/content/site';
import { platformRoot } from '@/lib/tenant';
import { PageHead } from '@/components/app/PageHead';
import { BrandEditor } from '@/components/app/BrandEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: appCopy.brand.title };

export default async function BrandPage() {
  const account = await requireLiveProducer();
  const p = account.producer;

  return (
    <>
      <PageHead title={appCopy.brand.title} sub={appCopy.brand.sub} />
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
