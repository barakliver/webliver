import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy, EVENT_KINDS } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';
import { InviteBox, type Invite } from '@/components/app/InviteBox';
import { TaskList, type Task } from '@/components/app/TaskList';
import { PaymentsPanel, type Payment } from '@/components/app/PaymentsPanel';
import { BudgetPanel, type BudgetItem } from '@/components/app/BudgetPanel';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList, type Guest } from '@/components/app/GuestList';
import { SeatingPlan, type SeatTable } from '@/components/app/SeatingPlan';
import { signBoardImages } from '@/lib/board';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireLiveProducer();
  const { id } = await params;

  const sb = await supabaseServer();
  const { data: client } = await sb
    .from('clients')
    .select('id,display_name,kind,event_date,venue,guest_estimate,budget_visible')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: invites }, { data: tasks }, { data: payments }, { data: budget }, { data: boardRows }, { data: guests }, { data: tables }] = await Promise.all([
    sb.from('client_authorized_emails').select('id,email,profile_id').eq('client_id', id).order('created_at'),
    sb.from('tasks').select('id,title,due_on,done,owner,created_by').eq('client_id', id)
      .order('done').order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('payments').select('id,title,amount,due_on,paid,paid_on').eq('client_id', id)
      .order('paid').order('due_on', { ascending: true, nullsFirst: false }),
    sb.from('budget_items').select('id,category,label,estimate,agreed,vendor').eq('client_id', id)
      .order('created_at'),
    sb.from('moodboards').select('id,client_id,category,caption,image_path').eq('client_id', id)
      .order('created_at', { ascending: false }),
    sb.from('guests_rsvp')
      .select('id,full_name,side,phone,status,party_size,diet,note,invite_token,table_id')
      .eq('client_id', id).order('full_name'),
    sb.from('tables_seating').select('id,name,seats').eq('client_id', id).order('created_at'),
  ]);
  const board = await signBoardImages(sb, (boardRows ?? []) as never);
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

      <div className="mt-6 space-y-6">
        <TaskList clientId={client.id} tasks={(tasks ?? []) as Task[]} viewer="producer" viewerId={account.id} />
        <PaymentsPanel clientId={client.id} payments={(payments ?? []) as Payment[]} viewer="producer" />
        <BudgetPanel
          clientId={client.id}
          items={(budget ?? []) as BudgetItem[]}
          viewer="producer"
          visible={!!client.budget_visible}
        />
        <GuestList clientId={client.id} guests={(guests ?? []) as Guest[]} />
        <SeatingPlan
          clientId={client.id}
          tables={(tables ?? []) as SeatTable[]}
          guests={(guests ?? []) as never}
        />
        <WinningBoard clientId={client.id} images={board} viewer="producer" />
      </div>
    </>
  );
}
