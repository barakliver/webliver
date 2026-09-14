import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { CrewDesk, type CrewPerson } from '@/components/app/CrewDesk';
import { CrewBoard, type BoardEvent, type BoardAssignment } from '@/components/app/CrewBoard';
import { expectedGuests } from '@/lib/crewNeeds';
import { Fold } from '@/components/Fold';
import { safeRows } from '@/lib/safe';
import { serverCopy } from '@/lib/serverLocale';
import { IssueReporter } from '@/components/app/IssueReporter';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).crew.deskTitle };
}

/**
 * The producer's own crew, which is his and not an event's.
 *
 * The same shape as the supplier directory next door, and row level security
 * scopes it to the signed-in producer, so there is nothing to filter here
 * beyond what the screen wants to show.
 */
export default async function CrewPage() {
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const [people, assignments, events, guestRows] = await Promise.all([
    safeRows<CrewPerson>('crew_members', sb
      .from('crew_members')
      .select('id,name,phone,email,roles,notes,archived_at')
      .order('name')),
    /* How many evenings each of them is on. Counted here, once, rather than
       by every row asking for itself: fifteen people is fifteen requests, and
       the answer is one column of one table. */
    safeRows<{ client_id: string; crew_member_id: string | null; slot: string | null }>('crew', sb
      .from('crew').select('client_id,crew_member_id,slot').not('crew_member_id', 'is', null)),
    /* The season: every open event, soonest first. Archived ones are gone
       because staffing a finished wedding is not a thing anybody means. */
    safeRows<{ id: string; display_name: string; event_date: string | null; guest_estimate: number | null }>(
      'events', sb.from('clients')
        .select('id,display_name,event_date,guest_estimate')
        .is('archived_at', null)
        .order('event_date', { ascending: true, nullsFirst: false })),
    /* The guest lists, so the rule here is applied to the same number the
       event screen applies it to rather than to the estimate alone. */
    safeRows<{ client_id: string; party_size: number | null }>('guest lists', sb
      .from('guests_rsvp').select('client_id,party_size')),
  ]);

  const tally = new Map<string, number>();
  for (const a of assignments) {
    if (!a.crew_member_id) continue;
    tally.set(a.crew_member_id, (tally.get(a.crew_member_id) ?? 0) + 1);
  }

  const listSize = new Map<string, number>();
  for (const g of guestRows) {
    listSize.set(g.client_id, (listSize.get(g.client_id) ?? 0) + Math.max(1, g.party_size ?? 1));
  }

  const board: BoardEvent[] = events.map((e) => ({
    id: e.id,
    name: e.display_name,
    date: e.event_date,
    guests: expectedGuests({ estimate: e.guest_estimate, invited: listSize.get(e.id) ?? null }),
  }));

  const placed: BoardAssignment[] = assignments
    .filter((a) => a.crew_member_id)
    .map((a) => ({ clientId: a.client_id, memberId: a.crew_member_id as string, slot: a.slot }));

  const rows: CrewPerson[] = people.map((p) => ({
    ...p,
    roles: Array.isArray(p.roles) ? p.roles : [],
    events: tally.get(p.id) ?? 0,
  }));

  return (
    <>
      <PageHead
        title={ui.crew.deskTitle} sub={ui.crew.deskSub}
        report={<IssueReporter userId={account.id} context={ui.crew.deskTitle} />}
      />
      <CrewDesk people={rows} />

      {/* The season, under the people it is staffed from. Folded, like
          everything else on his screens, and open because it is the thing
          the week is planned on. */}
      <div className="mt-8">
        <Fold id="crew-board" title={ui.crew.boardTitle} sub={ui.crew.boardSub} open>
          <CrewBoard events={board} people={rows} assignments={placed} />
        </Fold>
      </div>
      <Live sources={[{ table: 'crew_members' }, { table: 'crew' }]} />
    </>
  );
}
