import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { brandFor } from '@/lib/branding';
import { appCopy } from '@/content/site';
import { safeRows } from '@/lib/safe';
import { PrintButton } from '@/components/app/PrintButton';
import {
  NumbersSheet, type SheetGuest, type SheetTable, type SheetMoment, type SheetArrival,
} from '@/components/app/NumbersSheet';

const c = appCopy.numbers;

export const metadata = { title: appCopy.numbers.title };
export const dynamic = 'force-dynamic';

type CrewRow = { id: string; name: string; role: string; call_time: string | null };
type VendorRow = { id: string; name: string; category: string; call_time: string | null };

/**
 * The numbers sheet: the one page a supplier actually asks for.
 *
 * Every planner conversation with a caterer, a venue or a lighting crew opens
 * with the same three questions - how many, what, and when - and until now the
 * answers lived on three different tabs. This gathers them onto a single
 * print-first page: confirmed heads, the meal breakdown, who sits where, the
 * key moments, and everyone's call time.
 *
 * Printed rather than generated as a PDF, for the same reason the run sheet
 * is: the browser already lays out Hebrew-with-digits correctly and every
 * print dialog saves to PDF. The page is the document.
 *
 * Producer-only, unlike the run sheet, but not because of money - there is
 * deliberately not a shekel on it. It is producer-only because it is the
 * producer's document to hand out: the version the couple reads is their own
 * portal.
 *
 * The footer signs with the resolved brand, never the platform: the paper a
 * caterer holds is a tenant's stationery.
 */
export default async function NumbersSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireLiveProducer();
  const { id } = await params;

  const sb = await supabaseServer();
  const [{ data: client }, brand] = await Promise.all([
    sb.from('clients').select('id,display_name,event_date,venue').eq('id', id).maybeSingle(),
    brandFor(account),
  ]);
  if (!client) notFound();

  const [guests, tables, day, crew, vendors] = await Promise.all([
    safeRows<SheetGuest>('sheet guests', sb.from('guests_rsvp')
      .select('id,full_name,status,party_size,diet,table_id').eq('client_id', id).order('full_name')),
    safeRows<SheetTable>('sheet tables', sb.from('tables_seating')
      .select('id,name,seats').eq('client_id', id).order('created_at')),
    safeRows<SheetMoment>('sheet day', sb.from('day_schedule')
      .select('id,at_time,title,key_moment').eq('client_id', id).order('at_time')),
    safeRows<CrewRow>('sheet crew', sb.from('crew')
      .select('id,name,role,call_time').eq('client_id', id)),
    safeRows<VendorRow>('sheet vendors', sb.from('event_vendors')
      .select('id,name,category,call_time').eq('client_id', id)),
  ]);

  /* One clock: a call time is a call time, whoever holds it. */
  const arrivals: SheetArrival[] = [
    ...crew.map((m) => ({ id: m.id, name: m.name, role: m.role, call_time: m.call_time })),
    ...vendors.map((v) => ({ id: v.id, name: v.name, role: v.category, call_time: v.call_time })),
  ];

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/clients/${id}`} className="btn-quiet inline-flex items-center gap-1.5 px-0 text-[14px]">
          <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
          {c.back}
        </Link>
        <PrintButton label={c.print} />
      </div>

      <NumbersSheet
        client={client}
        guests={guests}
        tables={tables}
        day={day}
        arrivals={arrivals}
        brand={{ name: brand.name, tagline: brand.tagline || undefined }}
      />
    </>
  );
}
