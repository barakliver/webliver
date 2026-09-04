import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { FunnelChart, Sources, ResponsePanel, CashPanel, Health } from '@/components/app/Insights';
import {
  funnelOf, bySource, responseTime, cashOf, overdueTasks, signedShare,
  type LeadRow, type CallRow, type PaymentRow, type TaskRow, type ContractRow,
} from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const metadata = { title: appCopy.insights.title };

export default async function InsightsPage() {
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  /* Every one of these is already fenced by policy to the signed-in producer's
     own rows, so there is no producer filter here to forget: this screen
     cannot be made to show somebody else's business by editing a query. */
  const [leads, calls, payments, tasks, contracts, clients] = await Promise.all([
    sb.from('leads').select('id,status,source,created_at').limit(2000),
    sb.from('sales_calls').select('lead_id,created_at').limit(2000),
    sb.from('payments').select('amount,due_on,paid').limit(2000),
    sb.from('tasks').select('due_on,done').limit(4000),
    sb.from('contracts').select('client_id,signed_at').limit(1000),
    sb.from('clients').select('id').limit(1000),
  ]);

  const leadRows = (leads.data ?? []) as LeadRow[];
  const callRows = (calls.data ?? []) as CallRow[];
  const clientCount = clients.data?.length ?? 0;

  /* Nothing to draw is a sentence, not an empty chart. Four zeroed panels look
     like a broken screen; one line says which it is. */
  if (leadRows.length === 0 && clientCount === 0) {
    return (
      <>
        <PageHead title={appCopy.insights.title} sub={appCopy.insights.sub}
        report={<IssueReporter userId={account.id} context={appCopy.insights.title} />}
      />
        <Empty text={appCopy.insights.empty} />
      </>
    );
  }

  const funnel = funnelOf(leadRows, callRows);
  const response = responseTime(leadRows, callRows);
  const cash = cashOf((payments.data ?? []) as PaymentRow[]);
  const overdue = overdueTasks((tasks.data ?? []) as TaskRow[]);
  const signed = signedShare((contracts.data ?? []) as ContractRow[], clientCount);

  return (
    <>
      <PageHead title={appCopy.insights.title} sub={appCopy.insights.sub} />

      {/* What needs doing today comes before what happened this quarter. */}
      <div className="space-y-5">
        <Health signed={signed} overdue={overdue} waiting={response.waiting} />
        <CashPanel cash={cash} />
        <FunnelChart funnel={funnel} />
        <ResponsePanel r={response} />
        <Sources rows={bySource(leadRows)} />
      </div>
    </>
  );
}
