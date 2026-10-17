import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LeadCard, type FullLead, type LeadEvent, type LeadCall } from '@/components/app/LeadCard';
import { Live } from '@/components/app/Live';

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

  const [{ data: lead }, { data: events }, { data: calls }] = await Promise.all([
    sb.from('leads').select(FIELDS).eq('id', id).maybeSingle(),
    sb.from('lead_events').select('id,type,channel,body,meta,created_at').eq('lead_id', id).order('created_at', { ascending: true }).limit(300),
    sb.from('sales_calls').select('id,title,remind_on,done').eq('lead_id', id).order('remind_on', { ascending: true }),
  ]);
  if (!lead) notFound();

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
      />
      <Live sources={[{ table: 'leads' }, { table: 'lead_events' }, { table: 'sales_calls' }]} />
    </>
  );
}
