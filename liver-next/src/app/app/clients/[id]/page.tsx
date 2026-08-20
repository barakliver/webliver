import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy, EVENT_KINDS } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';
import { InviteBox, type Invite } from '@/components/app/InviteBox';
import { TaskList, type Task } from '@/components/app/TaskList';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireLiveProducer();
  const { id } = await params;

  const sb = await supabaseServer();
  const { data: client } = await sb
    .from('clients')
    .select('id,display_name,kind,event_date,venue,guest_estimate')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: invites }, { data: tasks }] = await Promise.all([
    sb.from('client_authorized_emails').select('id,email,profile_id').eq('client_id', id).order('created_at'),
    sb.from('tasks').select('id,title,due_on,done,owner,created_by').eq('client_id', id)
      .order('done').order('due_on', { ascending: true, nullsFirst: false }),
  ]);
  const c = appCopy.clientPage;
  const kind = EVENT_KINDS.find((k) => k.value === client.kind)?.label ?? client.kind;

  return (
    <>
      <Link href="/app/clients" className="btn-quiet mb-4 inline-block px-0 text-[14px]">← {c.back}</Link>
      <PageHead title={client.display_name} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.details}</h2>
          <dl className="mt-5 space-y-3 text-[14.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-mute">{appCopy.newClient.kind}</dt>
              <dd className="text-ink-soft">{kind}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-mute">{appCopy.newClient.date}</dt>
              <dd className="text-ink-soft">
                {client.event_date ? dateFmt.format(new Date(client.event_date)) : appCopy.clients.noDate}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-mute">{appCopy.newClient.venue}</dt>
              <dd className="text-ink-soft">{client.venue || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-mute">{appCopy.newClient.guests}</dt>
              <dd className="text-ink-soft">{client.guest_estimate ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <InviteBox clientId={client.id} invites={(invites ?? []) as Invite[]} />
      </div>

      <div className="mt-6">
        <TaskList clientId={client.id} tasks={(tasks ?? []) as Task[]} viewer="producer" viewerId={account.id} />
      </div>
    </>
  );
}
