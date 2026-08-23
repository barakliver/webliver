import type { Metadata, Viewport } from 'next';
import { getBrand, brandStyle } from '@/lib/tenant';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import './globals.css';

/**
 * The document title, theme colour and palette all follow the tenant that owns
 * the request — a producer on their own domain sees no trace of the platform.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { default: brand.brand_name, template: `%s · ${brand.brand_name}` },
    description: 'ניהול הפקת אירועים מקצה לקצה.',
    manifest: '/manifest.json',
    applicationName: brand.brand_name,
    appleWebApp: { capable: true, title: brand.brand_name, statusBarStyle: 'black-translucent' },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const brand = await getBrand();
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: brand.color_ink,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <html lang="he" dir="rtl">
      <body style={brandStyle(brand)}>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
