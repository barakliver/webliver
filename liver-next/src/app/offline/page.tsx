import type { Metadata } from 'next';
import { site } from '@/content/site';
import { brandForHost } from '@/lib/branding';
import { PromiseLine } from '@/components/Promise';

/* Free of anything personal: this page is precached by the service worker,
   which means it is stored on the device and shown to whoever opens the app
   next.

   Rendered per request rather than at build, because the service worker
   fetches it from whichever host the app was installed on. On a tenant's
   domain the cached page must carry the tenant's name, and the platform's
   promise line stays home: it is one producer's signature, not the system's. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'אין חיבור', robots: { index: false } };

export default async function OfflinePage() {
  const brand = await brandForHost();
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-[19px] font-semibold text-ink">{brand.isPlatform ? site.brand : brand.name}</p>
        {/* The one screen nobody chooses to see. Worth leaving something on
            other than an apology about the network. */}
        {brand.isPlatform ? <PromiseLine className="mb-6 mt-2" /> : <div className="mb-6 mt-2" />}
        <div className="card">
          <div aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-200 text-[22px]">📶</div>
          <h1 className="mt-4 font-display text-title font-semibold text-ink">אין חיבור לאינטרנט</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
            האפליקציה צריכה חיבור כדי להראות לכם מידע עדכני.
            ברגע שהחיבור יחזור, פשוט רעננו את הדף.
          </p>
        </div>
      </div>
    </main>
  );
}
