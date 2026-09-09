import type { Metadata, Viewport } from 'next';
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google';
import { site } from '@/content/site';
import { ServiceWorker } from '@/components/app/ServiceWorker';
import './globals.css';

/* Two families, three weights. Both carry Hebrew, which is the whole reason
   they were chosen over the pairing the design tooling suggested. */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'], variable: '--font-heebo',
  display: 'swap', weight: ['400', '500', '700'],
});
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'], variable: '--font-frank',
  display: 'swap', weight: ['500', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://liverproductions.com'),
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
      <body className="font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-2 focus:text-white">
          דלג לתוכן הראשי
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
