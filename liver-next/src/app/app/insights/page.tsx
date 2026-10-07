import { Suspense } from 'react';
import { ViewTransition } from '@/components/ViewTransition';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead, Empty } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LedgerEntries } from '@/components/app/LedgerEntries';
import { loadLedger } from '@/lib/ledger';
import { FunnelChart, Sources, ResponsePanel, CashPanel, Health, ConversionPanel } from '@/components/app/Insights';
import {
  funnelOf, bySource, responseTime, cashOf, overdueTasks, signedShare, conversionOf,
  type LeadRow, type CallRow, type PaymentRow, type TaskRow, type ContractRow,
} from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).insights.title };
}

export default async function InsightsPage() {
  const ui = await serverCopy();
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
    sb.from('clients').select('id,lead_id,created_at,display_name').limit(1000),
  ]);

  const leadRows = (leads.data ?? []) as LeadRow[];
  const callRows = (calls.data ?? []) as CallRow[];
  const clientCount = clients.data?.length ?? 0;

  /* Nothing to draw is a sentence, not an empty chart. Four zeroed panels look
     like a broken screen; one line says which it is. */
  if (leadRows.length === 0 && clientCount === 0) {
    return (
      <>
        <PageHead title={ui.insights.title} sub={ui.insights.sub}
        report={<IssueReporter userId={account.id} context={ui.insights.title} />}
      />
        <Empty text={ui.insights.empty} />
      </>
    );
  }

  const funnel = funnelOf(leadRows, callRows);
  const response = responseTime(leadRows, callRows);
  const cash = cashOf((payments.data ?? []) as PaymentRow[]);
  const overdue = overdueTasks((tasks.data ?? []) as TaskRow[]);
  const signed = signedShare((contracts.data ?? []) as ContractRow[], clientCount);
  /* Counted from events that exist rather than from a status somebody set
     by hand, which is the one number on this screen the funnel above it
     cannot give. */
  const conversion = conversionOf(leadRows, (clients.data ?? []) as { lead_id: string | null; created_at: string }[]);

  /* Attaching an entry to an event after the fact is the edit this list
     exists for, so the select needs every open file by name. */
  const ledgerEvents = ((clients.data ?? []) as { id: string; display_name: string | null }[])
    .map((r) => ({ id: String(r.id), name: r.display_name ?? '' }))
    .filter((e) => e.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));

  return (
    <>
      <PageHead title={ui.insights.title} sub={ui.insights.sub}
        report={<IssueReporter userId={account.id} context={ui.insights.title} />}
      />

      {/* What needs doing today comes before what happened this quarter. */}
      <div className="space-y-5">
        <Health signed={signed} overdue={overdue} waiting={response.waiting} />
        <CashPanel cash={cash} />
        {/* Behind a boundary, and it is the only await left inside this
            render. Sixty entries joined to their events is the slowest read
            on the slowest screen in the console, and awaiting it here held
            back the health panel, the cash panel and every chart under it —
            all of which were already in hand. Now they paint and the ledger
            arrives into the space kept for it. */}
        <Suspense
          fallback={
            <ViewTransition exit="yield" default="none">
              <LedgerSkeleton />
            </ViewTransition>
          }
        >
          {/* The skeleton yields and the ledger arrives, rather than one
              popping out and the other popping in. `default="none"` keeps
              this pair still during every unrelated navigation on the page. */}
          <ViewTransition enter="arrive" default="none">
            <Ledger sb={sb} events={ledgerEvents} />
          </ViewTransition>
        </Suspense>
        <FunnelChart funnel={funnel} />
        <ConversionPanel r={conversion} />
        <ResponsePanel r={response} />
        <Sources rows={bySource(leadRows)} />
      </div>
    </>
  );
}

/** The ledger, fetched on its own so nothing above it waits. */
async function Ledger({ sb, events }: {
  sb: Awaited<ReturnType<typeof supabaseServer>>; events: { id: string; name: string }[];
}) {
  return <LedgerEntries entries={await loadLedger(sb, { limit: 60 })} events={events} />;
}

/** The shape it will be: a title, three totals, and a run of rows. Held at
 *  the real heights, so the panels below it do not jump when it lands. */
function LedgerSkeleton() {
  return (
    <section className="card" aria-busy="true">
      <div className="skeleton h-5 w-36" />
      <div className="skeleton mt-3 h-4 w-full max-w-prose2" />
      <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-2 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-px border-t border-line pt-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-[46px] w-full rounded-none" />
        ))}
      </div>
    </section>
  );
}
