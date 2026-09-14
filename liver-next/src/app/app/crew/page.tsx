import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { CrewDesk, type CrewPerson } from '@/components/app/CrewDesk';
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

  const [people, assignments] = await Promise.all([
    safeRows<CrewPerson>('crew_members', sb
      .from('crew_members')
      .select('id,name,phone,email,roles,notes,archived_at')
      .order('name')),
    /* How many evenings each of them is on. Counted here, once, rather than
       by every row asking for itself: fifteen people is fifteen requests, and
       the answer is one column of one table. */
    safeRows<{ crew_member_id: string | null }>('crew', sb
      .from('crew').select('crew_member_id').not('crew_member_id', 'is', null)),
  ]);

  const tally = new Map<string, number>();
  for (const a of assignments) {
    if (!a.crew_member_id) continue;
    tally.set(a.crew_member_id, (tally.get(a.crew_member_id) ?? 0) + 1);
  }

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
      <Live sources={[{ table: 'crew_members' }, { table: 'crew' }]} />
    </>
  );
}
