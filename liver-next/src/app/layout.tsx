import type { Metadata, Viewport } from 'next';
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google';
import { site } from '@/content/site';
import { PLATFORM_HOST } from '@/lib/env';
import { ServiceWorker } from '@/components/app/ServiceWorker';
import './globals.css';
import { A11yPanel } from '@/components/a11y/A11yPanel';

/* Two families. Both carry Hebrew, which is the whole reason they were chosen
   over the pairings the design tooling suggested; most celebrated display
   faces ship no Hebrew glyphs at all.

   Frank drops to 300 and loses 700 entirely. It sets every heading and every
   large number, and at 104px a light weight carries by shape while a bold one
   turns an editorial page into a brochure. 400 stays for the sizes small
   enough that 300 goes thin.

   Heebo picks up 200 and 300 for the kickers and meta lines, which are set
   light and tracked wide rather than small and grey. */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'], variable: '--font-heebo',
  display: 'swap', weight: ['200', '300', '400', '500'],
});
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'], variable: '--font-frank',
  display: 'swap', weight: ['300', '400'],
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
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable}`}>
      <body className="font-sans antialiased a11y-zoom">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[100] focus:rounded-none focus:bg-ink focus:px-5 focus:py-2 focus:text-surface">
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
