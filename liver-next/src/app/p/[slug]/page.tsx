import type { Metadata } from 'next';
import Link from 'next/link';
import { supabasePublic } from '@/lib/supabase/public';
import { currentLocale } from '@/lib/serverLocale';
import { producerEntryFor } from '@/content/ui';
import { accentByKey, accentVars } from '@/content/brand';

export const dynamic = 'force-dynamic';

type Brand = { brand: string; tagline: string | null; accent: string | null; logo_url: string | null };

const SLUG = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/**
 * A producer's front door, on the platform's address.
 *
 * The problem it solves is the card WhatsApp draws. A producer shares the
 * sign-in link with a couple, the link sits on the platform's domain, and the
 * preview arrives carrying the platform owner's name and photograph - the one
 * thing a white label must never do. A producer's own domain fixes it fully
 * and needs DNS; this fixes the card today: /p/<slug> resolves the producer
 * by the slug they chose in the branding screen, and everything on the page
 * and in its metadata is theirs.
 *
 * The lookup reuses producer_by_host, which reads a slug from the first
 * label of whatever it is given; a bare slug is its own first label.
 */
async function load(slug: string): Promise<Brand | null> {
  if (!SLUG.test(slug)) return null;
  try {
    const { data, error } = await supabasePublic().rpc('producer_by_host', { p_host: slug });
    if (error) { console.error('[entry] lookup failed', error); return null; }
    const row = (Array.isArray(data) ? data[0] : data) as Brand | null;
    return row && row.brand ? row : null;
  } catch (e) {
    console.error('[entry] lookup threw', e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = await currentLocale();
  const c = producerEntryFor(locale);
  const b = await load(slug);
  if (!b) return { title: { absolute: c.gone }, robots: { index: false, follow: false } };

  const title = b.tagline ? `${b.brand} | ${b.tagline}` : b.brand;
  /* The producer's own mark as the card's image when they uploaded one;
     otherwise no image at all rather than the platform's. */
  const images = b.logo_url ? [{ url: b.logo_url }] : [];
  return {
    title: { absolute: title },
    description: c.sub,
    robots: { index: false, follow: true },
    openGraph: { type: 'website', siteName: b.brand, title, description: c.sub, images },
    twitter: { card: 'summary', title, description: c.sub, images: images.map((i) => i.url) },
  };
}

export default async function ProducerEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await currentLocale();
  const c = producerEntryFor(locale);
  const b = await load(slug);

  if (!b) {
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
        <div className="card w-full max-w-md text-center">
          <h1 className="font-display text-title font-light text-ink">{c.gone}</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{c.goneBody}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center px-5 py-14"
      style={accentVars(accentByKey(b.accent)) as React.CSSProperties}
    >
      <div className="w-full max-w-md text-center">
        {b.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logo_url} alt={b.brand} className="mx-auto h-14 w-auto max-w-[220px] object-contain" />
        ) : (
          <p className="font-display text-[34px] font-light leading-tight text-ink">{b.brand}</p>
        )}
        {b.tagline && <p className="mt-2 text-[14.5px] text-ink-mute">{b.tagline}</p>}
        <hr className="rule-gold mx-auto mt-8 w-24" />
        <p className="eyebrow mt-8">{c.eyebrow}</p>
        <p className="measure mx-auto mt-3 text-[15.5px] leading-relaxed text-ink-soft">{c.sub}</p>
        <Link href="/login" className="btn-primary mt-8">{c.enter}</Link>
      </div>
    </main>
  );
}
