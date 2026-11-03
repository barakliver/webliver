import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LeadCard, type FullLead, type LeadEvent, type LeadCall } from '@/components/app/LeadCard';
import { Live } from '@/components/app/Live';
import { LeadQuotes, type QuoteItem } from '@/components/app/LeadQuotes';
import { quoteFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { publicEnv } from '@/lib/env';
import { quoteStage, quoteUrl } from '@/lib/quote';
import { todayInZone } from '@/lib/clock';

export const dynamic = 'force-dynamic';

const FIELDS = 'id,full_name,partner_name,phone,email,instagram_handle,kind,event_date,event_date_flexible,'
  + 'guest_count,location,budget_min,budget_max,venue_booked,message,note,source,status,intent,urgency,'
  + 'score,score_reason,summary,suggested_reply,next_action,next_action_at,lost_reason,first_response_at,created_at';

/** The couple's name in the tab, read through the same policy as the page,
 *  so a producer who cannot see the lead gets the plain title. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ui = await serverCopy();
  const sb = await supabaseServer();
  const { data } = await sb.from('leads').select('full_name').eq('id', id).maybeSingle();
  const name = (data as { full_name?: string } | null)?.full_name;
  return { title: name ? `${name} · ${ui.leads.title}` : ui.pipeline.page.title };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const [{ data: lead }, { data: events }, { data: calls }, { data: quoteRows }, { data: pay }] = await Promise.all([
    sb.from('leads').select(FIELDS).eq('id', id).maybeSingle(),
    sb.from('lead_events').select('id,type,channel,body,meta,created_at').eq('lead_id', id).order('created_at', { ascending: true }).limit(300),
    sb.from('sales_calls').select('id,title,remind_on,done').eq('lead_id', id).order('remind_on', { ascending: true }),
    sb.from('price_quotes')
      .select('id,title,amount,status,choice,viewed_at,valid_until,token,created_at')
      .eq('lead_id', id).order('created_at', { ascending: false }).limit(20),
    sb.from('producers').select('payment_link,bank_details').eq('id', account.producer?.id ?? '').maybeSingle(),
  ]);
  if (!lead) notFound();

  const locale = await currentLocale();
  const today = todayInZone();
  const ways = pay as { payment_link: string; bank_details: string } | null;
  const quotes: QuoteItem[] = ((quoteRows ?? []) as {
    id: string; title: string; amount: number | string; status: string; choice: string | null;
    viewed_at: string | null; valid_until: string | null; token: string; created_at: string;
  }[]).map((q) => ({
    id: q.id, title: q.title, amount: Number(q.amount), created_at: q.created_at, valid_until: q.valid_until,
    stage: quoteStage(q, today), url: quoteUrl(publicEnv.siteUrl, q.token),
    live: q.status === 'sent',
  }));

  return (
    <>
      <PageHead
        title={ui.pipeline.page.title}
        report={<IssueReporter userId={account.id} context={`${ui.pipeline.page.title} ${id}`} />}
      />
      <LeadCard
        lead={lead as unknown as FullLead}
        events={(events ?? []) as LeadEvent[]}
        calls={(calls ?? []) as LeadCall[]}
        now={Date.now()}
        quotes={(
          <LeadQuotes
            leadId={id} defaultEmail={(lead as { email?: string }).email ?? ''} quotes={quotes}
            copy={quoteFor(locale)} locale={locale}
            ready={Boolean(ways && (ways.payment_link.trim() || ways.bank_details.trim()))}
          />
        )}
      />
      <Live sources={[{ table: 'leads' }, { table: 'lead_events' }, { table: 'sales_calls' }, { table: 'price_quotes' }]} />
    </>
  );
}
