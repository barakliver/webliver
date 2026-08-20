import type { Metadata } from 'next';
import { site } from '@/content/site';

/* Deliberately static and free of anything personal: this page is precached
   by the service worker, which means it is stored on the device and shown to
   whoever opens the app next. */
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'אין חיבור', robots: { index: false } };

export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <p className="mb-6 font-display text-[19px] font-semibold text-ink">{site.brand}</p>
        <div className="card">
          <div aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-haze-100 text-[22px]">📶</div>
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
