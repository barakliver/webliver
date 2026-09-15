import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { CrewDesk, type CrewPerson } from '@/components/app/CrewDesk';
import { CrewBoard, type BoardEvent, type BoardAssignment } from '@/components/app/CrewBoard';
import { expectedGuests } from '@/lib/crewNeeds';
import { ledgerOf, type PaidLine, type CostLine, type CrewLine } from '@/lib/finance';
import { clashes, earningsBy, clashingMembers, monthsOf } from '@/lib/crewLoad';
import { crewPay } from '@/lib/finance';
import { CrewMonths, type MonthRow } from '@/components/app/CrewMonths';
import { CrewClashes, type ClashRow } from '@/components/app/CrewClashes';
import { FillFees } from '@/components/app/FillFees';
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

  const [people, assignments, events, guestRows, payRows, costRows, feeRows] = await Promise.all([
    safeRows<CrewPerson>('crew_members', sb
      .from('crew_members')
      .select('id,name,phone,email,roles,rate,notes,archived_at,profile_id')
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
    /* The producer's own side of every event, in three reads rather than
       three per row. What the couple agreed to pay, what the suppliers cost,
       and what the crew costs — the same three inputs `ledgerOf` takes on the
       money tab, so the two screens cannot answer differently. */
    safeRows<PaidLine & { client_id: string }>('payments', sb
      .from('payments').select('client_id,amount,paid')),
    safeRows<CostLine & { client_id: string }>('budget lines', sb
      .from('budget_items').select('client_id,estimate,agreed')),
    safeRows<CrewLine & { id: string; client_id: string; crew_member_id: string | null }>('crew fees', sb
      .from('crew').select('id,client_id,crew_member_id,fee,extra_hours,hour_rate')),
  ]);

  /* Grouped once. Fifteen events reading their own money is forty-five
     requests for what is three columns of three tables. */
  function by<T extends { client_id: string }>(rows: readonly T[]): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.client_id, [...(m.get(r.client_id) ?? []), r]);
    return m;
  }
  const pays = by(payRows);
  const costs = by(costRows);
  const fees = by(feeRows);

  const tally = new Map<string, number>();
  for (const a of assignments) {
    if (!a.crew_member_id) continue;
    tally.set(a.crew_member_id, (tally.get(a.crew_member_id) ?? 0) + 1);
  }

  const listSize = new Map<string, number>();
  for (const g of guestRows) {
    listSize.set(g.client_id, (listSize.get(g.client_id) ?? 0) + Math.max(1, g.party_size ?? 1));
  }

  const board: BoardEvent[] = events.map((e) => {
    const l = ledgerOf(pays.get(e.id) ?? [], costs.get(e.id) ?? [], fees.get(e.id) ?? []);
    return {
      id: e.id,
      name: e.display_name,
      date: e.event_date,
      guests: expectedGuests({ estimate: e.guest_estimate, invited: listSize.get(e.id) ?? null }),
      money: {
        billed: l.billed, costs: l.costs, crew: l.crew,
        margin: l.margin, early: l.costsWithoutBilling,
      },
    };
  });

  /* The two things the season knows that no single evening does: who is
     booked twice on one night, and what each person has been paid across all
     of it. Both are worked out from the rows already read. */
  const paidPer = feeRows
    .filter((f) => f.crew_member_id)
    .map((f) => ({
      clientId: f.client_id, memberId: f.crew_member_id as string,
      fee: f.fee, extra_hours: f.extra_hours, hour_rate: f.hour_rate,
    }));

  const dateOf = new Map(events.map((e) => [e.id, e.event_date] as const));
  const nameOf = new Map(events.map((e) => [e.id, e.display_name] as const));
  const earned = earningsBy(paidPer);
  const doubled = clashingMembers(paidPer, dateOf);

  const clashRows: ClashRow[] = clashes(paidPer, dateOf).map((x) => ({
    memberId: x.memberId,
    name: people.find((p) => p.id === x.memberId)?.name ?? '',
    date: x.date,
    events: x.clientIds.map((id) => ({ id, name: nameOf.get(id) ?? '' })),
  }));

  /* The payment sheet: the same rows, grouped the way the paying happens.
     The crew row's own id comes along because the hours are written on it. */
  const crewRowFor = new Map(
    feeRows.filter((f) => f.crew_member_id)
      .map((f) => [`${f.client_id}|${f.crew_member_id}`, f] as const),
  );
  const nameOfPerson = new Map(people.map((p) => [p.id, p.name] as const));

  /* Assignments the rate never reached, because they were made before it was
     typed. Counted so the button can say how many rather than "done". */
  const rateOf = new Map(people.map((p) => [p.id, p.rate] as const));
  const missingFees = feeRows.filter((f) =>
    f.crew_member_id
    && (f.fee === null || f.fee === undefined)
    && rateOf.get(f.crew_member_id) !== null
    && rateOf.get(f.crew_member_id) !== undefined,
  ).length;

  const months: MonthRow[] = monthsOf(paidPer, dateOf).map((m) => ({
    month: m.month,
    total: m.total,
    people: m.people.map((per) => ({
      memberId: per.memberId,
      name: nameOfPerson.get(per.memberId) ?? '',
      total: per.total,
      evenings: per.lines.map((l) => {
        const row = crewRowFor.get(`${l.clientId}|${per.memberId}`);
        return {
          crewId: row?.id ?? '',
          clientId: l.clientId,
          clientName: nameOf.get(l.clientId) ?? '',
          date: l.date,
          fee: Number(row?.fee ?? 0),
          hours: row?.extra_hours === null || row?.extra_hours === undefined ? null : Number(row.extra_hours),
          hourRate: row?.hour_rate === null || row?.hour_rate === undefined ? null : Number(row.hour_rate),
          pay: row ? crewPay(row) : l.pay,
        };
      }),
    })),
  }));

  const placed: BoardAssignment[] = assignments
    .filter((a) => a.crew_member_id)
    .map((a) => ({ clientId: a.client_id, memberId: a.crew_member_id as string, slot: a.slot }));

  const rows: CrewPerson[] = people.map((p) => ({
    ...p,
    roles: Array.isArray(p.roles) ? p.roles : [],
    events: tally.get(p.id) ?? 0,
    earned: earned.get(p.id) ?? 0,
    clashes: doubled.has(p.id) ? 1 : 0,
    signedIn: !!(p as { profile_id?: string | null }).profile_id,
  }));

  return (
    <>
      <PageHead
        title={ui.crew.deskTitle} sub={ui.crew.deskSub}
        report={<IssueReporter userId={account.id} context={ui.crew.deskTitle} />}
      />
      {/* First on the screen, because it is the only thing on it that has a
          deadline. It disappears when it is fixed. */}
      {clashRows.length > 0 && (
        <div className="mb-5"><CrewClashes rows={clashRows} /></div>
      )}

      <CrewDesk people={rows} />

      {/* The season, under the people it is staffed from. Folded, like
          everything else on his screens, and open because it is the thing
          the week is planned on. */}
      <div className="mt-8">
        <Fold id="crew-board" title={ui.crew.boardTitle} sub={ui.crew.boardSub} open>
          <CrewBoard events={board} people={rows} assignments={placed} />
        </Fold>
      </div>
      {/* What to pay, under the season it was earned in. Folded, and closed
          at rest: it is a once-a-month screen sitting on a weekly one. */}
      <div className="mt-8">
        <Fold id="crew-months" title={ui.crew.monthsTitle} sub={ui.crew.monthsSub}>
          {/* First inside the drawer, because a month that adds up wrong adds
              up wrong for this reason nine times out of ten. */}
          <div className="mb-4"><FillFees missing={missingFees} /></div>
          <CrewMonths months={months} />
        </Fold>
      </div>

      <Live sources={[{ table: 'crew_members' }, { table: 'crew' }]} />
    </>
  );
}
