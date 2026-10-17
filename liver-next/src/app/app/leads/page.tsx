import { Live } from '@/components/app/Live';
import { ClipboardList } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead, Empty } from '@/components/app/PageHead';
import { LeadRow, type Lead, type Call } from '@/components/app/LeadRow';
import { LeadBoard } from '@/components/app/LeadBoard';
import { QuickLead } from '@/components/app/QuickLead';
import { CallsPanel } from '@/components/app/CallsPanel';
import { NewLeadForm } from '@/components/app/NewLeadForm';
import { LabelToolbar } from '@/components/app/LabelToolbar';
import { loadLabels } from '@/lib/labels';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LEAD_SOURCES } from '@/content/site';
import { LeadChannels } from '@/components/app/LeadChannels';
import type { LeadChannel } from '@/content/channels';
import { publicEnv } from '@/lib/env';
import { Fold } from '@/components/Fold';
import type { BoardLead } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).leads.title };
}

/**
 * The pipeline.
 *
 * It was two lists, "new" and "the rest", and a form at the top. It is the
 * board now: every enquiry in the column its status puts it in, the three
 * figures that say how the funnel is doing, and a quick add for the phone
 * that is still ringing. The full form, the channel addresses and the
 * follow-up calls are still here, behind a row, because they are things to
 * set up rather than things to read every morning.
 */
export default async function LeadsPage() {
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const channels = await loadLabels(sb, 'lead_channel');
  const [{ data: leads }, { data: calls }, { data: feeds }] = await Promise.all([
    sb.from('leads')
      .select('id,full_name,partner_name,email,phone,kind,event_date,guest_count,message,note,status,source,created_at,location,marketing_consent,marketing_consent_at,score,summary,first_response_at,next_action,next_action_at')
      .order('created_at', { ascending: false }).limit(300),
    sb.from('sales_calls').select('id,lead_id,title,remind_on,done')
      .order('remind_on', { ascending: true, nullsFirst: false }),
    sb.from('lead_channels')
      .select('id,label,source,token,enabled,last_lead_at,lead_count')
      .order('created_at', { ascending: false }),
  ]);

  const rows = (leads ?? []) as (Lead & BoardLead)[];
  const allCalls = (calls ?? []) as Call[];
  const callsFor = (leadId: string) => allCalls.filter((x) => x.lead_id === leadId);
  const sourceOptions = [
    ...LEAD_SOURCES.map((s) => ({ value: s.value, label: (ui.lead.sources as Record<string, string>)[s.value] ?? s.label })),
    ...channels.map((ch) => ({ value: ch.label, label: ch.label })),
  ];

  return (
    <>
      <PageHead
        title={ui.leads.title} sub={ui.leads.sub}
        actions={<QuickLead sources={sourceOptions} />}
        report={<IssueReporter userId={account.id} context={ui.leads.title} />}
      />

      {rows.length === 0 ? (
        <Empty text={ui.leads.empty} />
      ) : (
        <LeadBoard
          leads={rows}
          now={Date.now()}
          list={
            <ul className="list-none space-y-3 p-0">
              {rows.map((l) => <LeadRow key={l.id} lead={l} calls={callsFor(l.id)} />)}
            </ul>
          }
        />
      )}

      <div className="mt-8">
        <Fold id="fold-lead-setup" icon={ClipboardList} title={ui.pipeline.more.title} sub={ui.pipeline.more.sub}>
          <div className="space-y-6">
            <NewLeadForm channels={channels.map((ch) => ({ value: ch.label, label: ch.label }))} />
            <LabelToolbar
              kind="lead_channel"
              labels={channels}
              builtIn={LEAD_SOURCES.map((s) => s.label)}
            />
            <LeadChannels channels={(feeds ?? []) as LeadChannel[]} origin={publicEnv.siteUrl} />
            <CallsPanel calls={allCalls} leads={rows.map((l) => ({ id: l.id, name: l.full_name }))} />
          </div>
        </Fold>
      </div>

      <Live sources={[{ table: 'leads' }, { table: 'sales_calls' }]} />
    </>
  );
}
