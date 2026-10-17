import { requireLiveProducer } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { platformRoot } from '@/lib/tenant';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { BrandEditor } from '@/components/app/BrandEditor';
import { ProducerLinkCard } from '@/components/app/ProducerLinkCard';
import { BrandAssets } from '@/components/app/BrandAssets';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).brand.title };
}

export default async function BrandPage() {
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const p = account.producer;

  return (
    <>
      <PageHead title={ui.brand.title} sub={ui.brand.sub}
        report={<IssueReporter userId={account.id} context={ui.brand.title} />}
      />
      {/* First on the screen, above the editor: the reason most producers
          open this page after the first week is to get the link they send. */}
      <div className="mb-5"><ProducerLinkCard slug={p?.slug ?? null} /></div>
      <BrandEditor
        rootDomain={platformRoot()}
        /* The pictures, with the words: the logo is the first thing a new
           producer looks for on this screen. Passed in rather than drawn
           above because they sit beside the preview, outside the form. */
        assets={<BrandAssets urls={{ logo: p?.logoUrl ?? null, icon: p?.iconUrl ?? null, cover: p?.coverUrl ?? null }} />}
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
