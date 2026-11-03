import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { contactsCsv, type ContactRow } from '@/lib/campaign';

export const dynamic = 'force-dynamic';

/**
 * Everyone who came through a code, as a file Excel opens.
 *
 * The root address only: this is a list of people's names, phones and
 * addresses, and the policies behind it would hand an ordinary producer nothing
 * either. A visitor who is not root gets what any wrong address gets.
 */
export async function GET(request: Request) {
  const account = await currentAccount();
  if (account?.role !== 'super_admin') return new NextResponse('Not found', { status: 404 });

  const only = new URL(request.url).searchParams.get('c') ?? '';
  const sb = await supabaseServer();
  const [{ data: rows }, { data: camps }] = await Promise.all([
    (() => {
      let q = sb.from('contacts')
        .select('name,phone,email,campaign_id,terms_version,terms_accepted_at,broadcast_consent,broadcast_consent_at,broadcast_revoked_at,created_at,note')
        .order('created_at', { ascending: true }).limit(5000);
      if (only) q = q.eq('campaign_id', only);
      return q;
    })(),
    sb.from('signup_campaigns').select('id,name'),
  ]);
  const names = new Map(((camps ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const csv = contactsCsv(((rows ?? []) as (Omit<ContactRow, 'campaign'> & { campaign_id: string | null })[])
    .map((r) => ({ ...r, campaign: names.get(r.campaign_id ?? '') ?? '' })));

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
