import { CalendarPlus, Eye, Hash, ListOrdered, Radio, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { Live } from '@/components/app/Live';
import { workspaceSources } from '@/lib/liveSources';
import { PageHead } from '@/components/app/PageHead';
import { EventTabs, readTab, type EventTab } from '@/components/app/EventTabs';
import { IssueReporter } from '@/components/app/IssueReporter';
import { EventTagPicker } from '@/components/app/EventTagPicker';
import { loadLabels } from '@/lib/labels';
import { EventDetails } from '@/components/app/EventDetails';
import { EventSummary } from '@/components/app/EventSummary';
import { EventTemplate } from '@/components/app/EventTemplate';
import { ApplyTemplate } from '@/components/app/ApplyTemplate';
import { EventFileLists } from '@/components/app/EventFileLists';
import { loadEventFile } from '@/lib/eventFile';
import { loadTemplates } from '@/lib/workflow';
import { InviteBox, type Invite } from '@/components/app/InviteBox';
import { TaskList, type Task } from '@/components/app/TaskList';
import { PaymentsPanel, type Payment } from '@/components/app/PaymentsPanel';
import { BudgetPanel, type BudgetItem } from '@/components/app/BudgetPanel';
import { FinanceSummary } from '@/components/app/FinanceSummary';
import { ProducerLedger } from '@/components/app/ProducerLedger';
import { WinningBoard } from '@/components/app/WinningBoard';
import { GuestList, type Guest } from '@/components/app/GuestList';
import { GuestSiteCard } from '@/components/app/GuestSiteCard';
import { SeatingPlan, type SeatTable } from '@/components/app/SeatingPlan';
import { DaySchedule, type DayItem } from '@/components/app/DaySchedule';
import { CrewPanel, type CrewMember } from '@/components/app/CrewPanel';
import { BarCalculator } from '@/components/app/BarCalculator';
import { EventVendors, type EventVendor, type DirectoryEntry } from '@/components/app/EventVendors';
import { signBoardImages } from '@/lib/board';
import { safeRows, safeValue } from '@/lib/safe';
import { loadThread, loadContracts } from '@/lib/portal';
import { loadFiles } from '@/lib/files';
import { loadEventSummary } from '@/lib/eventSummary';
import { Contracts } from '@/components/app/Contracts';
import { EventFiles } from '@/components/app/EventFiles';
import { MeetingDrawer, type MeetingLog } from '@/components/app/MeetingDrawer';
import { Thread } from '@/components/app/Thread';

export const dynamic = 'force-dynamic';

const link =
  'inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl2 border border-line-strong bg-card px-4 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent';

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
    .select('id,display_name,kind,event_date,venue,guest_estimate,budget_visible,budget_target,label_id,track_a_label,track_b_label,guest_token,guest_site_on,guest_note,contact_email,contact_phone,brief')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  /* The producer's own colours, so this event can be given one. */
  const tags = await loadLabels(sb, 'event_tag');

  const c = appCopy.clientPage;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/clients" className="btn-quiet inline-block px-0 text-[14px]">← {c.back}</Link>
        {/* One row that scrolls on a phone rather than five buttons on three
            lines above the title. The last one is visibly cut off, which is
            what tells a thumb there is more. */}
        <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0 sm:pb-0">
          <a href={`/app/clients/${client.id}/event.ics`} className={link}>
            <CalendarPlus size={16} aria-hidden strokeWidth={1.5} />
            {appCopy.calendar.addEvent}
          </a>
          <Link href={`/app/clients/${client.id}/runsheet`} className={link}>
            <ListOrdered size={16} aria-hidden strokeWidth={1.5} />
            {appCopy.runsheet.open}
          </Link>
          {/* The page every supplier call asks for: how many, what, when.
              The run sheet is the evening; this is the numbers. */}
          <Link href={`/app/clients/${client.id}/sheet`} className={link}>
            <Hash size={16} aria-hidden strokeWidth={1.5} />
            {appCopy.numbers.open}
          </Link>
          {/* Everything at once, for the folder. The other sheets each answer
              one question; this one is the whole file, for the afternoon when
              there are no tabs and no signal. */}
          <Link href={`/app/clients/${client.id}/book`} className={link}>
            <BookOpen size={16} aria-hidden strokeWidth={1.5} />
            {appCopy.book.title}
          </Link>
          {/* The same evening, read on the evening. The printed sheet is for
              planning it; this one is for standing in the hall with it. */}
          <Link href={`/app/clients/${client.id}/live`} className={link}>
            <Radio size={16} aria-hidden strokeWidth={1.5} />
            {appCopy.dayOf.open}
          </Link>
          {/* The one honest way to answer "what can they actually see?" — which
              is a question about policy, not about markup, and therefore not
              one to answer from memory. */}
          <Link href={`/app/clients/${client.id}/preview`} className={link}>
            <Eye size={16} aria-hidden strokeWidth={1.5} />
            {appCopy.preview.open}
          </Link>
        </div>
      </div>

      <PageHead title={client.display_name}
        report={<IssueReporter userId={account.id} context={appCopy.clientPage.tabs[tab]} />}
      />

      {/* Above the tabs and outside them: which kind of thing this event is
          does not belong to any one section of its file. */}
      <div className="-mt-4 mb-5">
        <EventTagPicker clientId={client.id} labels={tags} current={client.label_id ?? null} />
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <EventTabs clientId={client.id} active={tab} />
        </div>
        {/* Named by the open tab, so a report from the money tab arrives
            saying so rather than costing a round trip to find out. */}
        <div className="mt-1 shrink-0">
          <IssueReporter userId={account.id} context={`${client.display_name} · ${appCopy.clientPage.tabs[tab]}`} />
        </div>
      </div>

      <Section tab={tab} client={client} viewerId={account.id} />

      <Live sources={workspaceSources(client.id)} />
    </>
  );
}

type Client = {
  id: string; display_name: string; kind: string; event_date: string | null;
  venue: string | null; guest_estimate: number | null; budget_visible: boolean | null;
  budget_target: number | null;
  label_id: string | null;
  guest_token: string | null; guest_site_on: boolean | null; guest_note: string | null;
  track_a_label: string; track_b_label: string;
};

/** One section's own data and markup. Splitting the fetches per section is the
 *  point of the sections: the guest list and the seating plan are the two
 *  heaviest reads on this page and most visits never open them. */
async function Section({ tab, client, viewerId }: { tab: EventTab; client: Client; viewerId: string }) {
  const sb = await supabaseServer();
  const id = client.id;

  if (tab === 'overview') {
    const [summary, invites, templates] = await Promise.all([
      loadEventSummary(sb, id),
      safeRows<Invite>('invites', sb.from('client_authorized_emails')
        .select('id,email,profile_id').eq('client_id', id).order('created_at')),
      loadTemplates(sb),
    ]);
    return (
      <div className="space-y-6">
        <EventSummary clientId={id} summary={summary} />
        {/* On the overview because this is where an event gets set up, and it
            collapses to a single button once there is nothing left to add. */}
        <EventTemplate clientId={id} />
        {/* The producer's own lists, next to the shipped ones. Renders nothing
            until they have built one. */}
        <ApplyTemplate clientId={id} templates={templates} hasDate={!!client.event_date} />
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
      /* The producer's own order first, then the fallbacks — so a list
         nobody has dragged still comes out sorted by what is due. */
      .order('done').order('sort_order').order('due_on', { ascending: true, nullsFirst: false }));
    return <TaskList clientId={id} tasks={tasks} viewer="producer" viewerId={viewerId} />;
  }

  if (tab === 'day') {
    const day = await safeRows<DayItem>('schedule', sb.from('day_schedule')
      .select('id,track,at_time,title,note,owner,audience,duration_min,key_moment')
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
        {/* The page the couple sends everyone. First on the tab, because the
            question it answers - "what do we send people?" - comes before the
            list ever fills. */}
        <GuestSiteCard
          clientId={id}
          token={client.guest_token}
          on={!!client.guest_site_on}
          note={client.guest_note ?? ''}
        />
        <GuestList clientId={id} guests={guests} />
        <SeatingPlan clientId={id} tables={tables} guests={guests as never} />
      </div>
    );
  }

  if (tab === 'details') {
    const { songs, kit, people } = await loadEventFile(sb, id);
    return <EventFileLists clientId={id} songs={songs} kit={kit} people={people} viewer="producer" />;
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
    const [payments, budget, crewFees] = await Promise.all([
      safeRows<Payment>('payments', sb.from('payments')
        .select('id,title,amount,due_on,paid,paid_on').eq('client_id', id)
        .order('paid').order('due_on', { ascending: true, nullsFirst: false })),
      safeRows<BudgetItem>('budget', sb.from('budget_items')
        .select('id,category,label,estimate,agreed,vendor').eq('client_id', id).order('created_at')),
      /* Fees only. The names belong on the crew screen; what this needs is a
         column that until now nothing anywhere had ever added up. */
      safeRows<{ fee: number | string | null }>('crew fees', sb.from('crew')
        .select('fee').eq('client_id', id)),
    ]);
    return (
      <div className="space-y-6">
        {/* The five figures first, then the two lists they are made of. */}
        <FinanceSummary
          clientId={id} viewer="producer"
          target={client.budget_target === null ? null : Number(client.budget_target)}
          items={budget} payments={payments}
        />
        {/* The couple's five figures above; the producer's bottom line here.
            Two ledgers on purpose, from one module, so they cannot be derived
            differently — and only this one is ever rendered for the couple. */}
        <ProducerLedger c={appCopy.money.ledger} payments={payments} items={budget} crew={crewFees} />
        <PaymentsPanel clientId={id} payments={payments} viewer="producer" />
        <BudgetPanel clientId={id} items={budget} viewer="producer" visible={!!client.budget_visible} />
      </div>
    );
  }

  if (tab === 'docs') {
    const contracts = await safeValue('contracts', loadContracts(sb, [id]), new Map());
    return <Contracts clientId={id} contracts={contracts.get(id) ?? []} viewer="producer" />;
  }

  if (tab === 'files') {
    const files = await safeValue('files', loadFiles(sb, [id]), new Map());
    return <EventFiles clientId={id} files={files.get(id) ?? []} viewer="producer" />;
  }

  if (tab === 'meetings') {
    const logs = await safeRows<MeetingLog>('meetings', sb.from('meeting_logs')
      .select('id,kind,title,held_on,answers,summary,summary_by,visible_to_client,updated_at')
      .eq('client_id', id)
      .order('held_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }));
    return <MeetingDrawer clientId={id} logs={logs} />;
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
