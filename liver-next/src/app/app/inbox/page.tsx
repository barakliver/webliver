import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { InboxList, type InboxItem, type InboxAction } from '@/components/app/InboxList';
import { Live } from '@/components/app/Live';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).inbox.title };
}

/**
 * The screen the producer opens in the morning instead of the mail.
 *
 * Everything that arrived in the last month, with its proposals, read
 * through the producer's own session; the list of live events for the
 * sorting box. Nothing on it writes until a button is pressed.
 */
export default async function InboxPage() {
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const sb = await supabaseServer();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: items }, { data: clients }] = await Promise.all([
    sb.from('inbox_items')
      .select('id,channel,from_identity,from_name,subject,body_text,attachments,received_at,client_id,match_confidence,match_reason,status,ai_summary,category')
      .gte('received_at', since).neq('status', 'ignored').order('received_at', { ascending: false }).limit(200),
    sb.from('clients').select('id,display_name').is('archived_at', null).order('event_date', { ascending: true }),
  ]);
  const rows = (items ?? []) as Omit<InboxItem, 'actions' | 'client_name'>[];
  const ids = rows.map((r) => r.id);
  const { data: actions } = ids.length
    ? await sb.from('suggested_actions').select('id,inbox_item_id,kind,title,payload,confidence,status,error').in('inbox_item_id', ids).order('created_at', { ascending: true })
    : { data: [] };
  const byItem = new Map<string, InboxAction[]>();
  for (const a of (actions ?? []) as (InboxAction & { inbox_item_id: string })[]) {
    if (!byItem.has(a.inbox_item_id)) byItem.set(a.inbox_item_id, []);
    byItem.get(a.inbox_item_id)?.push({ ...a, confidence: a.confidence === null ? null : Number(a.confidence) });
  }
  const names = new Map((clients ?? []).map((c) => [(c as { id: string }).id, (c as { display_name: string }).display_name]));
  const full: InboxItem[] = rows.map((r) => ({
    ...r, actions: byItem.get(r.id) ?? [], client_name: r.client_id ? names.get(r.client_id) ?? null : null,
  }));

  return (
    <>
      <PageHead title={ui.inbox.title} sub={ui.inbox.sub}
        report={<IssueReporter userId={account.id} context={ui.inbox.title} />} />
      <InboxList items={full} clients={[...names].map(([id, name]) => ({ id, name }))} />
      <Live sources={[{ table: 'inbox_items' }, { table: 'suggested_actions' }]} />
    </>
  );
}
