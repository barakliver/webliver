import { requireCrew } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { CrewShifts } from '@/components/app/CrewShifts';
import type { Shift } from '@/lib/crewPortal';
import { serverCopy } from '@/lib/serverLocale';
import { IssueReporter } from '@/components/app/IssueReporter';
import { todayInZone } from '@/lib/clock';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).crew.shiftsTitle };
}

/**
 * The crew member's own screen, and the only one they have.
 *
 * Everything is read through `crew_my_events`, a security-definer function
 * that returns the columns a crew member may see and no others. There is no
 * row level security policy anywhere that lets this account read `clients`,
 * `crew` or anything else directly, which is the point: see 0091.
 */
export default async function ShiftsPage() {
  const ui = await serverCopy();
  const account = await requireCrew();
  const sb = await supabaseServer();

  const { data, error } = await sb.rpc('crew_my_events');
  if (error) console.error('[shifts] read failed', error);

  return (
    <>
      <PageHead
        title={ui.crew.shiftsTitle} sub={ui.crew.shiftsSub}
        report={<IssueReporter userId={account.id} context={ui.crew.shiftsTitle} />}
      />
      <CrewShifts shifts={(data ?? []) as Shift[]} today={todayInZone()} />
    </>
  );
}
