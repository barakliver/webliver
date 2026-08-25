import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { formatDate } from '@/lib/dates';
import { PageHead, Empty } from '@/components/app/PageHead';
import { DayOfCockpit } from '@/components/app/DayOfCockpit';
import { Live } from '@/components/app/Live';
import type { Line, Caller } from '@/lib/dayof';

export const dynamic = 'force-dynamic';
export const metadata = { title: appCopy.dayOf.title };

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * The evening itself.
 *
 * Producer-only, and not because the run sheet is secret — the couple has
 * their own copy of it. What is on this screen and not on theirs is the call
 * sheet: who is staffed, when they were told to arrive, and their phone
 * number. Staffing has stayed on the producer's side of the wall everywhere
 * else here, and a screen that merges it into the schedule is exactly where
 * that boundary would quietly be lost.
 */
export default async function DayOfPage({ params }: { params: Promise<{ id: string }> }) {
  await requireLiveProducer();
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: client } = await sb
    .from('clients')
    .select('id,display_name,event_date,venue')
    .eq('id', id)
    .maybeSingle();

  if (!client) notFound();

  const [schedule, crew, vendors] = await Promise.all([
    sb.from('day_schedule').select('id,at_time,title,duration_min,done_at').eq('client_id', id),
    sb.from('crew').select('id,name,role,phone,call_time').eq('client_id', id),
    /* Only suppliers who are actually coming. A shortlist is a decision that
       has not been made, and putting three candidate photographers on a call
       sheet is how somebody ends up ringing the one who was not booked. */
    sb.from('event_vendors').select('id,name,category,phone,call_time')
      .eq('client_id', id).eq('status', 'booked'),
  ]);

  const lines = (schedule.data ?? []) as Line[];
  const crewRows: Caller[] = (crew.data ?? []).map((r) => ({
    id: r.id, name: r.name, role: r.role, phone: r.phone, call_time: r.call_time, kind: 'crew',
  }));
  const vendorRows: Caller[] = (vendors.data ?? []).map((r) => ({
    id: r.id, name: r.name, role: r.category, phone: r.phone, call_time: r.call_time, kind: 'vendor',
  }));

  const when = formatDate(dateFmt, client.event_date, '');

  return (
    <>
      <Link href={`/app/clients/${id}`} className="btn-quiet mb-2 -ms-3">
        <ArrowRight size={16} aria-hidden /> {appCopy.dayOf.toEvent}
      </Link>

      <PageHead
        title={appCopy.dayOf.title}
        sub={[client.display_name, when, client.venue].filter(Boolean).join(' · ')}
      />

      {lines.length === 0 && crewRows.length === 0 && vendorRows.length === 0 ? (
        <Empty text={appCopy.dayOf.empty} />
      ) : (
        <DayOfCockpit
          clientId={id}
          eventDate={client.event_date}
          lines={lines}
          crew={crewRows}
          vendors={vendorRows}
        />
      )}

      {/* Two phones on the same evening is the normal case, not the edge one:
          the producer ticks a line and whoever else is holding the sheet has
          to see it without being told to refresh. */}
      <Live sources={[{ table: 'day_schedule', filter: `client_id=eq.${id}` }]} />
    </>
  );
}
