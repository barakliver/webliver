import { notFound } from 'next/navigation';
import { requireCrew } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { CrewShift } from '@/components/app/CrewShift';
import type { ShiftDetail } from '@/lib/crewPortal';
import { serverCopy } from '@/lib/serverLocale';
import { todayInZone } from '@/lib/clock';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).crew.shiftOpen };
}

/**
 * One evening, for somebody working it.
 *
 * `crew_my_event` answers null when the caller is not on this event, and this
 * page turns that into a 404 rather than a refusal: "you are not on this
 * event" and "no such event" are the same answer to somebody who should not
 * be asking, and the difference between them is a way of enumerating events.
 */
export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCrew();
  const sb = await supabaseServer();

  const { data, error } = await sb.rpc('crew_my_event', { p_client: id });
  if (error) console.error('[shift] read failed', error);
  if (!data) notFound();

  return <CrewShift detail={data as ShiftDetail} today={todayInZone()} />;
}
