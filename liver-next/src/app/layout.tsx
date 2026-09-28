import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import { site } from '@/content/site';
import { siteEn } from '@/content/site.en';
import { brandForHost } from '@/lib/branding';
import { PAGE_GROUND } from '@/content/brand';
import { publicEnv } from '@/lib/env';
import { ServiceWorker } from '@/components/app/ServiceWorker';
import { VersionWatch } from '@/components/app/VersionWatch';
import './globals.css';
import { A11yPanel } from '@/components/a11y/A11yPanel';
import { a11yFor } from '@/content/ui';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, dirOf, readLocale } from '@/lib/locale';
import { BOOT_SCRIPT } from '@/lib/theme';
import { ThemeScope } from '@/components/ThemeScope';

/* One family: Heebo, everywhere, in both languages.

   Three were loaded before this — Heebo for the interface, Frank Ruhl Libre
   for the editorial display, and Lato with Playfair Display for an English
   page — and the history of how the display line moved is worth keeping,
   because every move was a ruling rather than a preference. The Lux
   direction set every heading in Frank Ruhl Libre. The `Event Platform.dc`
   handoff set everything in Heebo, and for a while that file was treated as
   the authority. Then he named MASTER.md, whose correction section lands on
   Frank Ruhl Libre, and the serif came back for display.

   And now he has ruled again, in one sentence: the type in the whole
   application is Heebo. So the other three are not downloaded at all. That
   is not only tidiness — three families at four weights each is a webfont
   bill every visitor pays, and two of them existed to keep an English page
   from setting Latin in a Hebrew face, which Heebo does not need help with.

   The tracking that belongs to this face is in tailwind.config.ts and in
   globals.css, negative where the serif era's was positive. Each swap of
   the family carries its tracking with it; both sets are in the history of
   those two files. */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'], variable: '--font-heebo',
  display: 'swap', weight: ['400', '500', '600', '700'],
});

/* Generated per request rather than exported flat, because the name and the
   description are two of the strings that change with the language. An English
   visitor was getting `Privacy policy | ברק ליור` in the tab and a Hebrew
   description in the search result, on a page whose body was entirely English.

   `siteEn` and `site` directly rather than through `getSiteCopy`: metadata is
   built for every route in the app, including screens behind sign in, and none
   of them is worth a database read. The producer's own overrides move the copy
   on the page; the tab keeps the shipped wording.

   The one read it does pay is the host lookup, and only on a tenant host:
   `brandForHost` short-circuits without touching the database when the tenant
   header is absent, which is every request to the platform's own address. On a
   tenant's domain the tab, the share card and the install name must all say
   the tenant — a white label whose browser tab still says the platform is a
   label that peels at the first screenshot. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const c = locale === 'en' ? siteEn : site;
  const description = locale === 'en'
    ? 'Wedding and event production, end to end. Planning, budget, suppliers and running the day itself.'
    : 'הפקת חתונות ואירועים מקצה לקצה. תכנון, תקציב, ספקים וניהול יום האירוע.';

  const brand = await brandForHost();
  if (!brand.isPlatform) {
    const title = brand.tagline ? `${brand.name} | ${brand.tagline}` : brand.name;
    /* The producer's own icon on the tab and on the home screen, when they
       uploaded one. A png is asked for on the branding screen, and iOS reads
       nothing else for apple-touch-icon. */
    const icon = brand.iconUrl ?? '/icon-192.png';
    return {
      metadataBase: new URL(publicEnv.siteUrl),
      title: { default: title, template: `%s | ${brand.name}` },
      description,
      appleWebApp: { capable: true, title: brand.name, statusBarStyle: 'black-translucent' },
      other: { 'apple-mobile-web-app-capable': 'yes' },
      icons: { icon, apple: icon },
      /* No og.jpg here: that file is the platform owner's photograph with his
         name set into it. A share card with the wrong producer's face is worse
         than a share card with no image. */
      openGraph: {
        type: 'website', locale: locale === 'en' ? 'en_US' : 'he_IL', siteName: brand.name,
        title, description,
      },
      twitter: { card: 'summary', title, description },
    };
  }

  return {
    /* `publicEnv.siteUrl` rather than the raw variable, which is the same
       guard the mailed links already got: a production build carrying a
       laptop's value would otherwise stamp localhost into every canonical and
       every share card. */
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${c.brand} | ${c.tagline}`, template: `%s | ${c.brand}` },
    description,
    appleWebApp: { capable: true, title: 'Liver', statusBarStyle: 'black-translucent' },
    /* `appleWebApp.capable` emits the standard `mobile-web-app-capable` and, in
       this version, not the legacy Apple one. Older iOS reads only the legacy
       tag, and without it an installed app opens inside Safari's chrome rather
       than standalone. Found by reading the rendered head on a phone viewport
       rather than by trusting the config, which said capable: true the whole
       time. */
    other: { 'apple-mobile-web-app-capable': 'yes' },
    icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
    /* The card a link carries when somebody sends it on.
     *
     *  The audit measured zero Open Graph tags and called it the most expensive
     *  finding in its list, for a reason that has nothing to do with search:
     *  couples pass this link to each other in WhatsApp, and a link with no
     *  image and no title arrives looking like spam. That is the strongest
     *  recommendation this business gets, a recommendation from a friend,
     *  rendered as a bare URL.
     *
     *  The tags existed by the time I checked. The image did not, which is the
     *  half WhatsApp actually shows. `/og.jpg` is one of his own photographs
     *  with his name set into the foot of it; `tools/og-card.py` at the repo
     *  root rebuilds it from `og-image.jpg` if the photograph or the wording
     *  ever changes. Absolute rather than relative, because several scrapers
     *  still do not resolve a relative og:image against the page. */
    openGraph: {
      type: 'website', locale: locale === 'en' ? 'en_US' : 'he_IL', siteName: c.brand,
      title: `${c.brand} | ${c.tagline}`,
      description,
      images: [{ url: `${publicEnv.siteUrl}/og.jpg`, width: 1200, height: 630, alt: `${c.brand} | ${c.tagline}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${c.brand} | ${c.tagline}`,
      description,
      images: [`${publicEnv.siteUrl}/og.jpg`],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  /* On a tenant's host the browser chrome takes the tenant's wash, so the
     status bar continues their page rather than framing it in the platform's
     colour. Same short-circuit as the metadata: no database read on the
     platform's own address. */
  const brand = await brandForHost();
  return {
    themeColor: brand.isPlatform ? PAGE_GROUND : brand.accent.wash,
    width: 'device-width',
    initialScale: 1,
    /* cover lets env(safe-area-inset-*) report real values; globals.css spends
       them, otherwise an installed app draws its header under the clock */
    viewportFit: 'cover',
  };
}

/* The one place the page's language and direction are decided. `dir` is an
   attribute on `<html>`, so nothing further down can flip it and everything
   further down inherits it — which is why the whole layout of this product is
   written in logical properties (`start`, `end`, `ms-`, `me-`) rather than in
   left and right. Change this one attribute and the design mirrors. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const dir = dirOf(locale);

  return (
    /* The theme is a class this element does not have until a line of script
       in the head puts it there, before the first paint. React compares what
       it rendered against what is in the document, and would report the
       class it did not write as a mismatch; this says that on this one
       element the difference is on purpose. */
    <html
      suppressHydrationWarning
      lang={locale}
      dir={dir}
      className={heebo.variable}
    >
      <head>
        {/* First thing in the document, ahead of the stylesheet. Anything
            later than this means the page draws the light palette and then
            corrects itself, which is a white flash on every navigation for
            the one person who asked not to have one. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        {/* Written by hand rather than through `metadata.manifest`, for one
            attribute: a manifest is fetched without cookies unless the link
            says `use-credentials`, and the manifest route needs the session
            to know whose app is being installed. Without it every producer
            installing from the platform's address got the platform's name on
            their home screen, whatever the shell said. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="font-sans antialiased a11y-zoom">
        {/* Pinned to the start edge rather than the right one, so it lands in
            the corner a reader of this language is already looking at. */}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100] focus:rounded-xl2 focus:bg-ink focus:px-5 focus:py-2 focus:text-surface">
          {locale === 'he' ? 'דלג לתוכן הראשי' : 'Skip to main content'}
        </a>
        {children}
        {/* Required on every screen, not only the marketing pages: the menu
            has to reach the app and the couple's portal too. */}
        <A11yPanel copy={a11yFor(locale)} />
        <ThemeScope />
        <ServiceWorker />
        <VersionWatch />
      </body>
    </html>
  );
}
