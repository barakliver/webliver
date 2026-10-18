import type { Metadata } from 'next';
import { site } from '@/content/site';
import { brandForHost } from '@/lib/branding';
import { PromiseLine } from '@/components/Promise';
import { OfflineWatcher } from '@/components/OfflineWatcher';

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
        <p className="font-display text-subhead font-normal text-ink">{brand.isPlatform ? site.brand : brand.name}</p>
        {/* The one screen nobody chooses to see. Worth leaving something on
            other than an apology about the network. */}
        {brand.isPlatform ? <PromiseLine className="mb-6 mt-2" /> : <div className="mb-6 mt-2" />}
        <OfflineWatcher
          copy={{
            offline: 'אין חיבור לאינטרנט',
            offlineBody: 'האפליקציה צריכה חיבור כדי להראות לכם מידע עדכני. ברגע שהחיבור יחזור, הדף יחזור לבד.',
            back: 'החיבור חזר',
            backBody: 'מחזירים אתכם למקום שבו הייתם.',
            retry: 'לנסות עכשיו',
          }}
        />
      </div>
    </main>
  );
}
