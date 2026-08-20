import type { Metadata, Viewport } from 'next';
import { Heebo, Assistant, Inter } from 'next/font/google';
import { site } from '@/content/site';
import { ServiceWorker } from '@/components/app/ServiceWorker';
import './globals.css';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo', display: 'swap', weight: ['300','400','500','700'] });
const assistant = Assistant({ subsets: ['hebrew', 'latin'], variable: '--font-assistant', display: 'swap', weight: ['400','500','600','700'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://liverproductions.com'),
  title: { default: `${site.brand} | ${site.tagline}`, template: `%s | ${site.brand}` },
  description: 'הפקת חתונות ואירועים מקצה לקצה. תכנון, תקציב, ספקים וניהול יום האירוע.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Liver', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  openGraph: {
    type: 'website', locale: 'he_IL', siteName: site.brand,
    title: `${site.brand} | ${site.tagline}`,
    description: 'הפקת חתונות ואירועים מקצה לקצה.',
  },
};

export const viewport: Viewport = {
  themeColor: '#f7fafd',
  width: 'device-width',
  initialScale: 1,
  /* cover lets env(safe-area-inset-*) report real values; globals.css spends
     them, otherwise an installed app draws its header under the clock */
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${assistant.variable} ${inter.variable}`}>
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
