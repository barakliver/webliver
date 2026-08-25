import { CalendarPlus, Eye, ListOrdered, Radio } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { Live } from '@/components/app/Live';
import { workspaceSources } from '@/lib/liveSources';
import { PageHead } from '@/components/app/PageHead';
import { EventTabs, readTab, type EventTab } from '@/components/app/EventTabs';
import { EventDetails } from '@/components/app/EventDetails';
import { EventSummary } from '@/components/app/EventSummary';
import { EventTemplate } from '@/components/app/EventTemplate';
import { InviteBox, type Invite } from '@/components/app/InviteBox';
import { TaskList, type Task } from '@/components/app/TaskList';
import { PaymentsPanel, type Payment } from '@/components/app/PaymentsPanel';
import { BudgetPanel, type BudgetItem } from '@/components/app/BudgetPanel';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList, type Guest } from '@/components/app/GuestList';
import { SeatingPlan, type SeatTable } from '@/components/app/SeatingPlan';
import { DaySchedule, type DayItem } from '@/components/app/DaySchedule';
import { CrewPanel, type CrewMember } from '@/components/app/CrewPanel';
import { BarCalculator } from '@/components/app/BarCalculator';
import { EventVendors, type EventVendor, type DirectoryEntry } from '@/components/app/EventVendors';
import { signBoardImages } from '@/lib/board';
import { safeRows, safeValue } from '@/lib/safe';
import { loadThread, loadContracts } from '@/lib/portal';
import { loadEventSummary } from '@/lib/eventSummary';
import { Contracts } from '@/components/app/Contracts';
import { Thread } from '@/components/app/Thread';

export const dynamic = 'force-dynamic';

const link =
  'inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent';

/**
 * One event, as its producer works on it.
 *
 * It used to be nine panels stacked on a single scroll, and every visit paid
 * to load all nine in order to show the one somebody came for. Now it is a
 * file with sections: the section is in the address, so it survives a reload
 * and can be sent to somebody, and the page fetches only what the open section
 * is about to draw.
 *
 * Every read below is allowed to fail on its own. The event itself is the only
 * thing this page cannot render without; everything else degrades to an empty
 * panel and a line in the log naming what broke.
 */
export default async function ClientPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const account = await requireLiveProducer();
  const { id } = await params;
  const tab = readTab((await searchParams).tab);

  const sb = await supabaseServer();
  const { data: client } = await sb
    .from('clients')
    .select('id,display_name,kind,event_date,venue,guest_estimate,budget_visible,track_a_label,track_b_label')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  const c = appCopy.clientPage;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/clients" className="btn-quiet inline-block px-0 text-[14px]">← {c.back}</Link>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/app/clients/${client.id}/event.ics`} className={link}>
            <CalendarPlus size={16} aria-hidden strokeWidth={1.75} />
            {appCopy.calendar.addEvent}
          </a>
          <Link href={`/app/clients/${client.id}/runsheet`} className={link}>
            <ListOrdered size={16} aria-hidden strokeWidth={1.75} />
            {appCopy.runsheet.open}
          </Link>
          {/* The same evening, read on the evening. The printed sheet is for
              planning it; this one is for standing in the hall with it. */}
          <Link href={`/app/clients/${client.id}/live`} className={link}>
            <Radio size={16} aria-hidden strokeWidth={1.75} />
            {appCopy.dayOf.open}
          </Link>
          {/* The one honest way to answer "what can they actually see?" — which
              is a question about policy, not about markup, and therefore not
              one to answer from memory. */}
          <Link href={`/app/clients/${client.id}/preview`} className={link}>
            <Eye size={16} aria-hidden strokeWidth={1.75} />
            {appCopy.preview.open}
          </Link>
        </div>
      </div>

      <PageHead title={client.display_name} />
      <EventTabs clientId={client.id} active={tab} />

      <Section tab={tab} client={client} viewerId={account.id} />

      <Live sources={workspaceSources(client.id)} />
    </>
  );
}

type Client = {
  id: string; display_name: string; kind: string; event_date: string | null;
  venue: string | null; guest_estimate: number | null; budget_visible: boolean | null;
  track_a_label: string; track_b_label: string;
};

/** One section's own data and markup. Splitting the fetches per section is the
 *  point of the sections: the guest list and the seating plan are the two
 *  heaviest reads on this page and most visits never open them. */
async function Section({ tab, client, viewerId }: { tab: EventTab; client: Client; viewerId: string }) {
  const sb = await supabaseServer();
  const id = client.id;

  if (tab === 'overview') {
    const [summary, invites] = await Promise.all([
      loadEventSummary(sb, id),
      safeRows<Invite>('invites', sb.from('client_authorized_emails')
        .select('id,email,profile_id').eq('client_id', id).order('created_at')),
    ]);
    return (
      <div className="space-y-6">
        <EventSummary clientId={id} summary={summary} />
        {/* On the overview because this is where an event gets set up, and it
            collapses to a single button once there is nothing left to add. */}
        <EventTemplate clientId={id} />
        <div className="grid gap-6 lg:grid-cols-2">
          <EventDetails event={client} />
          <InviteBox clientId={id} invites={invites} />
        </div>
      </div>
    );
  }

  if (tab === 'tasks') {
    const tasks = await safeRows<Task>('tasks', sb.from('tasks')
      .select('id,title,due_on,done,owner,created_by,visible_to_client').eq('client_id', id)
      .order('done').order('due_on', { ascending: true, nullsFirst: false }));
    return <TaskList clientId={id} tasks={tasks} viewer="producer" viewerId={viewerId} />;
  }

  if (tab === 'day') {
    const day = await safeRows<DayItem>('schedule', sb.from('day_schedule')
      .select('id,track,at_time,title,note,owner,audience,duration_min')
      .eq('client_id', id).order('at_time'));
    return (
      <DaySchedule
        clientId={id}
        items={day}
        labelA={client.track_a_label}
        labelB={client.track_b_label}
      />
    );
  }

  if (tab === 'guests') {
    const [guests, tables] = await Promise.all([
      safeRows<Guest>('guests', sb.from('guests_rsvp')
        .select('id,full_name,side,phone,status,party_size,diet,note,invite_token,table_id')
        .eq('client_id', id).order('full_name')),
      safeRows<SeatTable>('tables', sb.from('tables_seating')
        .select('id,name,seats').eq('client_id', id).order('created_at')),
    ]);
    return (
      <div className="space-y-6">
        <GuestList clientId={id} guests={guests} />
        <SeatingPlan clientId={id} tables={tables} guests={guests as never} />
      </div>
    );
  }

  if (tab === 'crew') {
    /* The directory comes along so a supplier can be booked without leaving
       the event. It is the producer's own book and row level security already
       scopes it to them; the archived ones are left out because booking a
       retired supplier is not a thing anybody means to do. */
    const [crew, eventVendors, directory] = await Promise.all([
      safeRows<CrewMember>('crew', sb.from('crew')
        .select('id,name,role,phone,call_time,fee,notes')
        .eq('client_id', id).order('call_time', { ascending: true, nullsFirst: false })),
      safeRows<EventVendor>('event vendors', sb.from('event_vendors')
        .select('id,vendor_id,name,category,phone,status,call_time,notes')
        .eq('client_id', id).order('category')),
      safeRows<DirectoryEntry>('vendor directory', sb.from('vendors')
        .select('id,name,category,phone').is('archived_at', null).order('name')),
    ]);
    return (
      <div className="space-y-6">
        <EventVendors clientId={id} vendors={eventVendors} directory={directory} />
        <CrewPanel clientId={id} crew={crew} />
      </div>
    );
  }

  if (tab === 'bar') {
    /* Seats rather than invitations, and only the ones who said yes: twelve
       invitations can be thirty people, and thirty is the number a bar is
       stocked for. The estimate is the fallback until anybody has replied. */
    const guests = await safeRows<{ status: string; party_size: number | null }>('bar guests',
      sb.from('guests_rsvp').select('status,party_size').eq('client_id', id));
    const confirmed = guests
      .filter((g) => g.status === 'attending')
      .reduce((sum, g) => sum + (g.party_size ?? 1), 0);

    return <BarCalculator guestEstimate={client.guest_estimate} confirmedGuests={confirmed} />;
  }

  if (tab === 'money') {
    const [payments, budget] = await Promise.all([
      safeRows<Payment>('payments', sb.from('payments')
        .select('id,title,amount,due_on,paid,paid_on').eq('client_id', id)
        .order('paid').order('due_on', { ascending: true, nullsFirst: false })),
      safeRows<BudgetItem>('budget', sb.from('budget_items')
        .select('id,category,label,estimate,agreed,vendor').eq('client_id', id).order('created_at')),
    ]);
    return (
      <div className="space-y-6">
        <PaymentsPanel clientId={id} payments={payments} viewer="producer" />
        <BudgetPanel clientId={id} items={budget} viewer="producer" visible={!!client.budget_visible} />
      </div>
    );
  }

  if (tab === 'docs') {
    const contracts = await safeValue('contracts', loadContracts(sb, [id]), new Map());
    return <Contracts clientId={id} contracts={contracts.get(id) ?? []} viewer="producer" />;
  }

  if (tab === 'messages') {
    const threads = await safeValue('thread', loadThread(sb, [id]), new Map());
    return <Thread clientId={id} messages={threads.get(id) ?? []} viewerId={viewerId} />;
  }

  /* board */
  const rows = await safeRows<{ id: string }>('moodboard', sb.from('moodboards')
    .select('id,client_id,category,caption,image_path').eq('client_id', id)
    .order('created_at', { ascending: false }));
  /* Signing image links reaches storage, and a missing bucket or a file
     deleted underneath its row must not cost the producer the whole screen. */
  const board = await safeValue('moodboard links', signBoardImages(sb, rows as never), []);
  return <WinningBoard clientId={id} images={board} viewer="producer" />;
}
