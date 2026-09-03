import { Live } from '@/components/app/Live';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy, leadsCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { LeadRow, type Lead, type Call } from '@/components/app/LeadRow';
import { CallsPanel } from '@/components/app/CallsPanel';
import { NewLeadForm } from '@/components/app/NewLeadForm';
import { LabelToolbar } from '@/components/app/LabelToolbar';
import { loadLabels } from '@/lib/labels';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LEAD_SOURCES } from '@/content/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: appCopy.leads.title };

export default async function LeadsPage() {
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const channels = await loadLabels(sb, 'lead_channel');
  const [{ data: leads }, { data: calls }] = await Promise.all([
    sb.from('leads')
      .select('id,full_name,email,phone,kind,event_date,guest_count,message,note,status,source,created_at,location')
      .order('created_at', { ascending: false }).limit(200),
    sb.from('sales_calls').select('id,lead_id,title,remind_on,done')
      .order('remind_on', { ascending: true, nullsFirst: false }),
  ]);

  const rows = (leads ?? []) as Lead[];
  const allCalls = (calls ?? []) as Call[];
  const callsFor = (leadId: string) => allCalls.filter((x) => x.lead_id === leadId);

  /* the ones that have not been answered yet are the ones worth seeing first */
  const fresh = rows.filter((l) => l.status === 'new');
  const rest = rows.filter((l) => l.status !== 'new');

  return (
    <>
      <PageHead title={appCopy.leads.title} sub={appCopy.leads.sub} />

      {/* Ahead of the list on purpose. The enquiry a producer is holding in
          their head, still on the phone, is the one at risk of never being
          written down at all. */}
      <NewLeadForm channels={channels.map((ch) => ({ value: ch.label, label: ch.label }))} />

      {/* The producer's own channels, edited where the funnel is read. A
          channel nobody can add is a funnel that measures our guesses. */}
      <div className="my-6">
        <LabelToolbar
          kind="lead_channel"
          labels={channels}
          builtIn={LEAD_SOURCES.map((s) => s.label)}
        />
      </div>

      <CallsPanel calls={allCalls} leads={rows.map((l) => ({ id: l.id, name: l.full_name }))} />

      <div className="mb-4 flex justify-end">
        <IssueReporter userId={account.id} context={appCopy.leads.title} />
      </div>

      {rows.length === 0 ? (
        <Empty text={appCopy.leads.empty} />
      ) : (
        <div className="mt-6 space-y-6">
          {fresh.length > 0 && (
            <div>
              <h2 className="mb-3 text-[13px] font-semibold text-accent">
                {leadsCopy.statuses.new} · {fresh.length}
              </h2>
              <ul className="space-y-3">
                {fresh.map((l) => <LeadRow key={l.id} lead={l} calls={callsFor(l.id)} />)}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <h2 className="mb-3 text-[13px] font-semibold text-ink-mute">{appCopy.leads.title} · {rest.length}</h2>
              <ul className="space-y-3">
                {rest.map((l) => <LeadRow key={l.id} lead={l} calls={callsFor(l.id)} />)}
              </ul>
            </div>
          )}
        </div>
      )}
      <Live sources={[{ table: 'leads' }, { table: 'sales_calls' }]} />
    </>
  );
}
