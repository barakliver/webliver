import type { Metadata, Viewport } from 'next';
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google';
import { site } from '@/content/site';
import { siteEn } from '@/content/site.en';
import { publicEnv } from '@/lib/env';
import { ServiceWorker } from '@/components/app/ServiceWorker';
import { VersionWatch } from '@/components/app/VersionWatch';
import './globals.css';
import { A11yPanel } from '@/components/a11y/A11yPanel';
import { a11yFor } from '@/content/ui';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, dirOf, readLocale } from '@/lib/locale';

/* Two families, which is what his own design document specifies.

   This line has moved twice, and the history is worth keeping. The Lux
   direction set every heading in Frank Ruhl Libre; the `Event Platform.dc.html`
   handoff set everything in Heebo, and for a while that file was treated as the
   authority and the serif came out. Then he ruled on it himself: the font he
   named is the one in `design-system/liver-productions/MASTER.md`, whose own
   correction section lands on Frank Ruhl Libre for display, because the
   Cormorant it started from ships no Hebrew and this site is Hebrew first.

   So: Frank Ruhl Libre carries the headings, the promise line and the large
   numerals, at the light weight that carries by shape at 104px. Heebo stays on
   everything read at 13 to 16px, where a serif costs legibility and buys
   nothing. Both faces ship real Hebrew, which is the non-negotiable that
   disqualified the Latin pairing in the first place.

   The display tracking in tailwind.config.ts is positive again, .01 to .02em:
   a light serif closes up without air, the opposite of what Heebo needed. The
   two sets of values are both in the git history of that file. */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'], variable: '--font-heebo',
  display: 'swap', weight: ['300', '400', '500', '600', '700', '800'],
});
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'], variable: '--font-frank',
  display: 'swap', weight: ['300', '400', '500'],
});

/* Generated per request rather than exported flat, because the name and the
   description are two of the strings that change with the language. An English
   visitor was getting `Privacy policy | ברק ליור` in the tab and a Hebrew
   description in the search result, on a page whose body was entirely English.

   `siteEn` and `site` directly rather than through `getSiteCopy`: metadata is
   built for every route in the app, including screens behind sign in, and none
   of them is worth a database read. The producer's own overrides move the copy
   on the page; the tab keeps the shipped wording. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const c = locale === 'en' ? siteEn : site;
  const description = locale === 'en'
    ? 'Wedding and event production, end to end. Planning, budget, suppliers and running the day itself.'
    : 'הפקת חתונות ואירועים מקצה לקצה. תכנון, תקציב, ספקים וניהול יום האירוע.';

  return {
    /* `publicEnv.siteUrl` rather than the raw variable, which is the same
       guard the mailed links already got: a production build carrying a
       laptop's value would otherwise stamp localhost into every canonical and
       every share card. */
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${c.brand} | ${c.tagline}`, template: `%s | ${c.brand}` },
    description,
    manifest: '/manifest.webmanifest',
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

export const viewport: Viewport = {
  /* The app's own ground, so the browser chrome and the status bar continue
     the page rather than framing it. Left behind by the palette change once
     already, which is what a stale hex in a second file looks like. */
  themeColor: '#F3F6FA',
  width: 'device-width',
  initialScale: 1,
  /* cover lets env(safe-area-inset-*) report real values; globals.css spends
     them, otherwise an installed app draws its header under the clock */
  viewportFit: 'cover',
};

/* The one place the page's language and direction are decided. `dir` is an
   attribute on `<html>`, so nothing further down can flip it and everything
   further down inherits it — which is why the whole layout of this product is
   written in logical properties (`start`, `end`, `ms-`, `me-`) rather than in
   left and right. Change this one attribute and the design mirrors. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const dir = dirOf(locale);

  return (
    <html lang={locale} dir={dir} className={`${heebo.variable} ${frank.variable}`}>
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
        <ServiceWorker />
        <VersionWatch />
      </body>
    </html>
  );
}
