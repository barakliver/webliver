import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, readLocale } from '@/lib/locale';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { brandForHost } from '@/lib/branding';
import { djFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { storeHasItems } from '@/lib/store';
import { Nav } from '@/components/marketing/Nav';
import { Section } from '@/components/marketing/Section';
import { SiteFooter } from '@/components/marketing/SiteFooter';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const c = djFor(await currentLocale());
  return {
    title: c.metaTitle,
    description: c.metaSub,
    alternates: { canonical: '/dj' },
    openGraph: { url: '/dj', title: c.metaTitle, description: c.metaSub },
  };
}

/**
 * The platform talking to DJs, on the platform's own address only.
 *
 * Same guard as the page for producers and for the same reason: a tenant's
 * site is that tenant's business, and a page that sells the machinery behind
 * it would tell their couples who really runs it. The funnel it feeds is the
 * existing one: sign in with Google, say you are a DJ, be approved, or come in
 * at once through a conference code.
 */
export default async function DjPage() {
  const brand = await brandForHost();
  if (!brand.isPlatform) notFound();

  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const sb = supabasePublic();
  const site = await getSiteCopy(sb, locale);
  const shop = await storeHasItems(sb);
  const c = djFor(locale);

  return (
    <>
      <Nav site={site} locale={locale} shop={shop} />

      <main id="main">
        <Section eyebrow={c.eyebrow} title={c.title} sub={c.sub} level={1}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary">{c.cta}</Link>
            <p className="text-body text-ink-soft">{c.ctaNote}</p>
          </div>
        </Section>

        <Section title={c.problemTitle} className="pt-0">
          <ul className="measure list-none space-y-3 p-0">
            {c.problem.map((line) => (
              <li key={line} className="flex items-baseline gap-3 text-head leading-relaxed text-ink-soft">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.getTitle} sub={c.getSub}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.get.map((item) => (
              <div key={item.title} className="card reveal transition-transform duration-touch hover:-translate-y-0.5">
                <h3 className="head-panel">{item.title}</h3>
                <p className="mt-2 text-body leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={c.startTitle}>
          <ol className="grid list-none gap-6 p-0 sm:grid-cols-3">
            {c.start.map((step, i) => (
              <li key={step.title} className="reveal">
                <span aria-hidden className="font-display text-figure font-light leading-none text-accent-bright">{i + 1}</span>
                <h3 className="mt-2 head-sub">{step.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary">{c.cta}</Link>
            <p className="text-body text-ink-soft">{c.ctaNote}</p>
          </div>
        </Section>
      </main>

      <SiteFooter brand={site.brand} note={site.footer} locale={locale} />
    </>
  );
}
