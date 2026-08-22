import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LIver Productions',
  description: 'הפקת אירועים מקצה לקצה — חתונות, אירועים עסקיים והפקות שטח.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'LIver', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14130f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
