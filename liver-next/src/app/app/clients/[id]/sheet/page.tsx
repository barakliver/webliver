import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { brandFor } from '@/lib/branding';
import { serverCopy } from '@/lib/serverLocale';
import { safeRows } from '@/lib/safe';
import { PrintButton } from '@/components/app/PrintButton';
import { DocSwatches } from '@/components/app/DocSwatches';
import { hhmm, inDayOrder } from '@/lib/runsheet';
import { cn } from '@/lib/utils';
import {
  NumbersSheet, type SheetGuest, type SheetTable, type SheetMoment, type SheetArrival,
} from '@/components/app/NumbersSheet';


export async function generateMetadata() {
  return { title: (await serverCopy()).numbers.title };
}
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
/* The parts of the sheet, in the order it prints. A supplier is handed the
   parts they ask for: the caterer wants the meals and the seating and has no
   use for the DJ's call time, and the DJ the other way round. Which parts are
   left off lives in the address (`?off=diet,seating`) so a choice is a link
   somebody can send, and the paper it prints is the paper they chose. */
const PARTS = ['counts', 'diet', 'seating', 'schedule', 'arrivals'] as const;

export default async function NumbersSheetPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ off?: string }>;
}) {
  const c = (await serverCopy()).numbers;
  const account = await requireLiveProducer();
  const { id } = await params;
  const off = ((await searchParams).off ?? '').split(',').filter((p) => (PARTS as readonly string[]).includes(p));

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
        <Link href={`/app/clients/${id}`} className="btn-quiet inline-flex items-center gap-1.5 px-0 text-body">
          <ArrowLeft size={16} aria-hidden strokeWidth={1.5} />
          {c.back}
        </Link>
        <PrintButton label={c.print} />
      </div>

      {/* On screen only: the four numbers, and which parts this copy carries. */}
      {(() => {
        const attending = guests.filter((g) => g.status === 'attending');
        const heads = attending.reduce((n, g) => n + Number(g.party_size || 0), 0);
        const special = attending
          .filter((g) => g.diet && g.diet !== 'none')
          .reduce((n, g) => n + Number(g.party_size || 0), 0);
        const first = inDayOrder(arrivals.filter((a) => a.call_time).map((a) => ({ ...a, at_time: a.call_time! })))[0];
        return (
          <>
            <DocSwatches
              className="mb-6"
              items={[
                { key: 'heads', tone: 'rubine', label: c.heads, value: heads },
                { key: 'tables', tone: 'boho', label: c.figTables, value: tables.length },
                { key: 'special', tone: 'camel', label: c.figSpecial, value: special },
                { key: 'first', tone: 'tamarind', label: c.figFirstCall, value: <span dir="ltr">{first ? hhmm(first.at_time) : '·'}</span> },
              ]}
            />
            <nav aria-label={c.pick} className="no-print mb-7">
              <p className="mb-2 text-meta text-ink-mute">{c.pick}</p>
              <ul className="flex list-none flex-wrap gap-2 p-0">
                {PARTS.map((part) => {
                  const on = !off.includes(part);
                  const next = on ? [...off, part] : off.filter((p) => p !== part);
                  const label = { counts: c.counts, diet: c.diet, seating: c.seating, schedule: c.schedule, arrivals: c.arrivals }[part];
                  return (
                    <li key={part}>
                      <Link
                        href={next.length ? `/app/clients/${id}/sheet?off=${next.join(',')}` : `/app/clients/${id}/sheet`}
                        scroll={false}
                        aria-current={on ? 'true' : undefined}
                        className={cn(
                          'inline-flex min-h-[44px] items-center gap-2 rounded-button border px-4 text-body transition sm:min-h-[38px]',
                          on ? 'border-tone-rubine bg-tone-rubine text-tone-rubine-on' : 'border-line-strong text-ink-mute line-through hover:text-ink',
                        )}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </>
        );
      })()}

      <NumbersSheet
        off={off}
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
