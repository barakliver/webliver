import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, MessageCircle } from 'lucide-react';
import { supabasePublic } from '@/lib/supabase/public';
import { normalizePhone } from '@/lib/phone';
import { currentLocale } from '@/lib/serverLocale';
import { producerEntryFor } from '@/content/ui';
import { accentByKey, accentVars } from '@/content/brand';

export const dynamic = 'force-dynamic';

type Brand = {
  brand: string; tagline: string | null; accent: string | null; logo_url: string | null;
  whatsapp: string | null; booking_url: string | null;
  icon_url: string | null; cover_url: string | null;
};

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
  /* The cover as the card's image when they uploaded one, the mark when they
     uploaded only that; otherwise no image at all rather than the platform's.
     A wide photograph gets the large card, a logo the small one: a logo
     stretched across a WhatsApp preview is the look of a business that did
     not check. */
  const image = b.cover_url ?? b.logo_url;
  const images = image ? [{ url: image }] : [];
  const icon = b.icon_url ?? undefined;
  return {
    title: { absolute: title },
    description: c.sub,
    robots: { index: false, follow: true },
    icons: icon ? { icon, apple: icon } : undefined,
    openGraph: { type: 'website', siteName: b.brand, title, description: c.sub, images },
    twitter: { card: b.cover_url ? 'summary_large_image' : 'summary', title, description: c.sub, images: images.map((i) => i.url) },
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
          <p className="mt-3 text-lead leading-relaxed text-ink-soft">{c.goneBody}</p>
        </div>
      </main>
    );
  }

  /* The producer's own ways in, when they filled them in on the branding
     screen. A visitor who landed here from a group message may not be a
     couple yet; the page is the producer's card as much as their door. */
  const wa = normalizePhone(b.whatsapp);
  const booking = (b.booking_url ?? '').trim();

  return (
    <main
      id="main"
      className="brand-scope app-type flex min-h-dvh items-center justify-center px-5 py-14"
      style={accentVars(accentByKey(b.accent)) as React.CSSProperties}
    >
      {/* The door as a card: the cover runs to its edges, the mark and the
          words come up one after another, and the three ways in are three
          full-width buttons, the first of them the one that matters. Each
          arrives a beat after the last, which is the only thing on this page
          that moves. */}
      <div className="w-full max-w-md overflow-hidden rounded-panel border border-line-soft bg-card text-center">
        {b.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.cover_url} alt=""
            className="aspect-video w-full object-cover" decoding="async" />
        )}
        <div className="px-6 pb-8 pt-8 sm:px-8">
          <div className="animate-rise">
            {b.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo_url} alt={b.brand} className="mx-auto h-14 w-[220px] max-w-[220px] object-contain" decoding="async" />
            ) : (
              <p className="font-display text-[34px] font-light leading-tight text-ink">{b.brand}</p>
            )}
          </div>
          {b.tagline && <p className="animate-rise mt-2 text-body text-ink-mute" style={{ animationDelay: '.1s' }}>{b.tagline}</p>}
          <hr className="rule-gold mx-auto mt-6 w-24" />
          <p className="eyebrow animate-rise mt-6" style={{ animationDelay: '.2s' }}>{c.eyebrow}</p>
          <p className="measure animate-rise mx-auto mt-3 text-lead leading-relaxed text-ink-soft" style={{ animationDelay: '.28s' }}>{c.sub}</p>
          <div className="mt-7 flex flex-col gap-2.5">
            <Link href="/login" className="btn-primary animate-rise justify-center" style={{ animationDelay: '.36s' }}>{c.enter}</Link>
            {wa && (
              <a href={`https://wa.me/${wa.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-ghost animate-rise justify-center" style={{ animationDelay: '.44s' }}>
                <MessageCircle size={16} strokeWidth={1.5} aria-hidden />
                {c.whatsapp}
              </a>
            )}
            {booking && (
              <a href={booking} target="_blank" rel="noopener noreferrer" className="btn-ghost animate-rise justify-center" style={{ animationDelay: '.52s' }}>
                <CalendarDays size={16} strokeWidth={1.5} aria-hidden />
                {c.booking}
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
