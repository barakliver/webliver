import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireRoot } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { joinUrl } from '@/lib/campaign';
import { PrintButton } from '@/components/app/PrintButton';
import { site } from '@/content/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'דף QR להדפסה' };

/**
 * One sheet for the stand: the code as large as the page allows, one line
 * telling people what to do with it, and the address underneath for the person
 * whose camera will not focus. Paper stays white and the button does not print.
 */
export default async function QrSheet({ params }: { params: Promise<{ id: string }> }) {
  await requireRoot();
  const { id } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.from('signup_campaigns').select('name,token,kind').eq('id', id).maybeSingle();
  const k = data as { name: string; token: string; kind: 'producer' | 'dj' } | null;
  if (!k) notFound();

  const url = joinUrl(publicEnv.appUrl, k.token);
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, color: { dark: '#000000', light: '#ffffff' } });

  return (
    <div className="mx-auto max-w-xl">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <p className="text-body text-ink-soft">לחצו להדפסה, או לשמירה כ-PDF.</p>
        <PrintButton label="הדפסה" />
      </div>
      <div className="print-doc space-y-6 bg-white p-8 text-center text-black">
        <p className="text-figure font-light">{site.brand}</p>
        <h1 className="text-[44px] font-light leading-tight">סרקו כדי להיכנס</h1>
        <p className="text-panel">
          {k.kind === 'dj' ? 'מערכת לניהול לקוחות ל-DJ' : 'מערכת לניהול הפקות אירועים'}
        </p>
        <div
          role="img" aria-label="QR" className="mx-auto w-[min(100%,420px)] [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p dir="ltr" className="break-all text-lead">{url.replace(/^https?:\/\//, '')}</p>
        <p className="text-lead">{k.name}</p>
      </div>
    </div>
  );
}
