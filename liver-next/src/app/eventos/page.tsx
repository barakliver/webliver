import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, readLocale } from '@/lib/locale';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { brandForHost } from '@/lib/branding';
import { eventOsFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { storeHasItems } from '@/lib/store';
import { Nav } from '@/components/marketing/Nav';
import { Section } from '@/components/marketing/Section';
import { DarkBand } from '@/components/marketing/DarkBand';
import { SiteFooter } from '@/components/marketing/SiteFooter';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const c = eventOsFor(await currentLocale());
  return {
    title: c.metaTitle,
    description: c.metaSub,
    alternates: { canonical: '/eventos' },
    openGraph: { url: '/eventos', title: c.metaTitle, description: c.metaSub },
  };
}

/**
 * The one page on this site that sells the machinery rather than the evening.
 *
 * Everything else here is a wedding producer talking to couples. This is the
 * platform talking to producers, which is a different reader with a different
 * question: not whether the evening will be beautiful but whether this saves
 * the Sunday they spend rebuilding a spreadsheet.
 *
 * It exists only on the platform's own address, and that is the whole reason
 * this file has a guard in it. The product is white-labelled: a producer can
 * point their own domain at it, and on that domain every screen is their
 * business and nothing mentions this one. A marketing page for the platform
 * appearing on a tenant's site would tell that tenant's couples exactly who
 * really runs their producer's software — which is the single promise the
 * white-labelling makes. brandForHost returns isPlatform only when no tenant
 * host matched, so a tenant gets a 404 here, the same as for a page that does
 * not exist. Which, on their site, it does not.
 *
 * The funnel it feeds is the one that already exists rather than a new one:
 * sign in with an email, a producer workspace is created in a pending state,
 * and somebody approves it by hand. No form to build, no table to add. The
 * page's job is to explain the thing and point at the door.
 */
export default async function EventOsPage() {
  const brand = await brandForHost();
  if (!brand.isPlatform) notFound();

  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const sb = supabasePublic();
  const site = await getSiteCopy(sb, locale);
  const shop = await storeHasItems(sb);
  const c = eventOsFor(locale);

  return (
    <>
      <Nav site={site} locale={locale} shop={shop} />

      <main id="main">
        {/* level 1, because this page opens with a section rather than the
            marketing hero: a page whose first heading is an h2 has a hole
            where its subject should be. */}
        <Section eyebrow={c.eyebrow} title={c.title} sub={c.sub} level={1}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary">{c.cta}</Link>
            <p className="text-[14px] text-ink-soft">{c.ctaNote}</p>
          </div>
        </Section>

        {/* The problem before the product. A producer who does not recognise
            their own Sunday in this list is not the reader for the rest. */}
        <Section title={c.problemTitle} className="pt-0">
          <ul className="measure list-none space-y-3 p-0">
            {c.problem.map((line) => (
              <li key={line} className="flex items-baseline gap-3 text-[16.5px] leading-relaxed text-ink-soft">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.getTitle} sub={c.getSub}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.get.map((item) => (
              <div key={item.title} className="card">
                <h3 className="font-display text-[18px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={c.coupleTitle} className="pt-0">
          <p className="measure text-[16.5px] leading-relaxed text-ink-soft">{c.coupleBody}</p>
        </Section>

        {/* On the dark band because it is the claim a producer is most likely
            to disbelieve, and the one this whole architecture was built for. */}
        <DarkBand title={c.whiteTitle} body={c.whiteBody} cta={c.cta} href="/login" />

        <Section title={c.startTitle}>
          <ol className="grid list-none gap-6 p-0 sm:grid-cols-3">
            {c.start.map((step, i) => (
              <li key={step.title}>
                <span aria-hidden className="font-display text-[26px] font-semibold leading-none text-accent-bright">
                  {i + 1}
                </span>
                <h3 className="mt-2 font-display text-[17px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary">{c.cta}</Link>
            <p className="text-[14px] text-ink-soft">{c.ctaNote}</p>
          </div>
        </Section>
      </main>

      <SiteFooter brand={site.brand} note={site.footer} locale={locale} />
    </>
  );
}
