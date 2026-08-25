import { CalendarPlus, Eye, ListOrdered } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy, EVENT_KINDS } from '@/content/site';
import { Live } from '@/components/app/Live';
import { workspaceSources } from '@/lib/realtime';
import { PageHead } from '@/components/app/PageHead';
import { InviteBox, type Invite } from '@/components/app/InviteBox';
import { TaskList, type Task } from '@/components/app/TaskList';
import { PaymentsPanel, type Payment } from '@/components/app/PaymentsPanel';
import { BudgetPanel, type BudgetItem } from '@/components/app/BudgetPanel';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList, type Guest } from '@/components/app/GuestList';
import { SeatingPlan, type SeatTable } from '@/components/app/SeatingPlan';
import { DaySchedule, type DayItem } from '@/components/app/DaySchedule';
import { signBoardImages } from '@/lib/board';
import { safeRows, safeValue } from '@/lib/safe';
import { loadThread, loadContracts } from '@/lib/portal';
import { Contracts } from '@/components/app/Contracts';
import { Thread } from '@/components/app/Thread';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireLiveProducer();
  const { id } = await params;

  const sb = await supabaseServer();
  const { data: client } = await sb
    .from('clients')
    .select('id,display_name,kind,event_date,venue,guest_estimate,budget_visible,track_a_label,track_b_label')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  /* Every read below is allowed to fail on its own. The event itself is the
     only thing this page cannot render without; everything else degrades to
     an empty panel and a line in the log naming what broke. */
  const [invites, tasks, payments, budget, boardRows, guests, tables, day] = await Promise.all([
    safeRows<Invite>('invites', sb.from('client_authorized_emails')
      .select('id,email,profile_id').eq('client_id', id).order('created_at')),
    safeRows<Task>('tasks', sb.from('tasks')
      .select('id,title,due_on,done,owner,created_by').eq('client_id', id)
      .order('done').order('due_on', { ascending: true, nullsFirst: false })),
    safeRows<Payment>('payments', sb.from('payments')
      .select('id,title,amount,due_on,paid,paid_on').eq('client_id', id)
      .order('paid').order('due_on', { ascending: true, nullsFirst: false })),
    safeRows<BudgetItem>('budget', sb.from('budget_items')
      .select('id,category,label,estimate,agreed,vendor').eq('client_id', id).order('created_at')),
    safeRows<{ id: string }>('moodboard', sb.from('moodboards')
      .select('id,client_id,category,caption,image_path').eq('client_id', id)
      .order('created_at', { ascending: false })),
    safeRows<Guest>('guests', sb.from('guests_rsvp')
      .select('id,full_name,side,phone,status,party_size,diet,note,invite_token,table_id')
      .eq('client_id', id).order('full_name')),
    safeRows<SeatTable>('tables', sb.from('tables_seating')
      .select('id,name,seats').eq('client_id', id).order('created_at')),
    safeRows<DayItem>('schedule', sb.from('day_schedule')
      .select('id,track,at_time,title,note').eq('client_id', id).order('at_time')),
  ]);

  /* Signing image links reaches storage, and a missing bucket or a file
     deleted underneath its row must not cost the producer the whole screen. */
  const board = await safeValue('moodboard links', signBoardImages(sb, boardRows as never), []);

  const [threads, contracts] = await Promise.all([
    safeValue('thread', loadThread(sb, [id]), new Map()),
    safeValue('contracts', loadContracts(sb, [id]), new Map()),
  ]);

  const c = appCopy.clientPage;
  const kind = EVENT_KINDS.find((k) => k.value === client.kind)?.label ?? client.kind;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/clients" className="btn-quiet inline-block px-0 text-[14px]">← {c.back}</Link>
        <div className="flex flex-wrap items-center gap-2">
        {/* The one honest way to answer "what can they actually see?" — which
            is a question about policy, not about markup, and therefore not one
            to answer from memory. */}
        <a
          href={`/app/clients/${client.id}/event.ics`}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-medium text-ink transition hover:border-bronze/40 hover:text-bronze"
        >
          <CalendarPlus size={16} aria-hidden strokeWidth={1.75} />
          {appCopy.calendar.addEvent}
        </a>
        <Link
          href={`/app/clients/${client.id}/runsheet`}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-medium text-ink transition hover:border-bronze/40 hover:text-bronze"
        >
          <ListOrdered size={16} aria-hidden strokeWidth={1.75} />
          {appCopy.runsheet.open}
        </Link>
        <Link
          href={`/app/clients/${client.id}/preview`}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-medium text-ink transition hover:border-bronze/40 hover:text-bronze"
        >
          <Eye size={16} aria-hidden strokeWidth={1.75} />
          {appCopy.preview.open}
        </Link>
        </div>
      </div>
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

        <InviteBox clientId={client.id} invites={invites} />
      </div>

      <div className="mt-6 space-y-6">
        <TaskList clientId={client.id} tasks={tasks} viewer="producer" viewerId={account.id} />
        <PaymentsPanel clientId={client.id} payments={payments} viewer="producer" />
        <BudgetPanel
          clientId={client.id}
          items={budget}
          viewer="producer"
          visible={!!client.budget_visible}
        />
        <GuestList clientId={client.id} guests={guests} />
        <SeatingPlan
          clientId={client.id}
          tables={tables}
          guests={guests as never}
        />
        <DaySchedule
          clientId={client.id}
          items={day}
          labelA={client.track_a_label}
          labelB={client.track_b_label}
        />
        <Contracts clientId={client.id} contracts={contracts.get(client.id) ?? []} viewer="producer" />
        <Thread clientId={client.id} messages={threads.get(client.id) ?? []} viewerId={account.id} />
        <WinningBoard clientId={client.id} images={board} viewer="producer" />
      </div>
      <Live sources={[...workspaceSources(client.id), { table: 'messages', filter: `client_id=eq.${client.id}` }, { table: 'contracts', filter: `client_id=eq.${client.id}` }]} />
    </>
  );
}
