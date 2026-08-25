import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import { site } from '@/content/site';
import { PLATFORM_HOST } from '@/lib/env';
import { ServiceWorker } from '@/components/app/ServiceWorker';
import './globals.css';
import { A11yPanel } from '@/components/a11y/A11yPanel';

/* One family, and it is the one the handoff names.

   The design source is `Event Platform.dc.html`, and the brief that came with
   it says in as many words that when it and the README disagree, that file
   wins. It sets everything in Heebo: headings, figures, kickers, body. There
   is no second face and no serif anywhere in it.

   What shipped instead was Frank Ruhl Libre on every heading and every large
   number, from the warm Lux direction. That is a beautiful face and it is not
   this design — and it is the single reason the screens carried the right
   palette and still did not look like the thing that was designed. A serif
   headline is not a detail somebody overlooks.

   Heebo carries Hebrew properly, which is why it was chosen over the display
   pairings the tooling suggests; most of those ship no Hebrew glyphs at all.
   The full range is loaded because the design uses it: 300 for the large
   figures, 800 for the places it wants weight.

   Display sizes are tracked tight rather than wide. That is a property of
   this face at these sizes and it is in the config: -0.035em on a headline,
   -0.04em on a metric, which is the opposite of what the serif needed. */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'], variable: '--font-heebo',
  display: 'swap', weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? `https://${PLATFORM_HOST}`),
  title: { default: `${site.brand} | ${site.tagline}`, template: `%s | ${site.brand}` },
  description: 'הפקת חתונות ואירועים מקצה לקצה. תכנון, תקציב, ספקים וניהול יום האירוע.',
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
  openGraph: {
    type: 'website', locale: 'he_IL', siteName: site.brand,
    title: `${site.brand} | ${site.tagline}`,
    description: 'הפקת חתונות ואירועים מקצה לקצה.',
  },
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans antialiased a11y-zoom">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[100] focus:rounded-xl2 focus:bg-ink focus:px-5 focus:py-2 focus:text-surface">
          דלג לתוכן הראשי
        </a>
        {children}
        {/* Required on every screen, not only the marketing pages: the menu
            has to reach the app and the couple's portal too. */}
        <A11yPanel />
        <ServiceWorker />
      </body>
    </html>
  );
}
