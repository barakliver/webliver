import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { brandFor } from '@/lib/branding';
import { safeRows } from '@/lib/safe';
import { appCopy } from '@/content/site';
import { appUiFor } from '@/content/appUi';
import { currentLocale } from '@/lib/serverLocale';
import { daysBetween, todayInZone } from '@/lib/clock';
import { standingOf } from '@/lib/phase';
import { PrintButton } from '@/components/app/PrintButton';
import {
  ProductionBook, type BookVendor, type BookCrew, type BookMoment,
  type BookTask, type BookPayment,
} from '@/components/app/ProductionBook';

export const metadata = { title: appCopy.book.title };
export const dynamic = 'force-dynamic';

type GuestRow = { status: string; party_size: number; diet: string };

/**
 * The production book, assembled from whatever the event actually has.
 *
 * Eight screens' worth of an evening on one document. Every section is
 * allowed to be empty and says so in its own words, because a book printed
 * three months out is mostly empty and is still the right thing to hand
 * somebody — a blank running order is information.
 *
 * Producer-only, and not for a money reason: the couple's version of this is
 * their own portal. What is on here — supplier balances, who has not paid,
 * everyone's phone number — is the machinery of the job.
 *
 * The standing on the cover is the same reading the dashboard gives, from the
 * same engine, so the paper in the folder cannot disagree with the screen it
 * was printed from.
 */
export default async function ProductionBookPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireLiveProducer();
  const { id } = await params;
  const locale = await currentLocale();
  const c = appUiFor(locale).book;

  const sb = await supabaseServer();
  const [{ data: client }, brand] = await Promise.all([
    sb.from('clients')
      .select('id,display_name,event_date,venue,contact_phone,contact_email,guests_estimate')
      .eq('id', id).maybeSingle(),
    brandFor(account),
  ]);
  if (!client) notFound();

  const [guestRows, vendors, crew, moments, tasks, payments] = await Promise.all([
    safeRows<GuestRow>('book guests', sb.from('guests_rsvp')
      .select('status,party_size,diet').eq('client_id', id)),
    safeRows<BookVendor>('book vendors', sb.from('event_vendors')
      .select('id,name,category,phone,status,call_time').eq('client_id', id)
      .order('category').order('name')),
    safeRows<BookCrew>('book crew', sb.from('crew')
      .select('id,name,role,phone,call_time').eq('client_id', id).order('call_time')),
    safeRows<BookMoment>('book schedule', sb.from('day_schedule')
      .select('id,at_time,title,note,owner').eq('client_id', id).order('at_time')),
    safeRows<BookTask>('book tasks', sb.from('tasks')
      .select('id,title,due_on,done').eq('client_id', id)
      .order('done').order('due_on', { ascending: true, nullsFirst: false })),
    safeRows<BookPayment>('book payments', sb.from('payments')
      .select('id,title,amount,due_on,paid').eq('client_id', id)
      .order('paid').order('due_on', { ascending: true, nullsFirst: false })),
  ]);

  /* Heads rather than rows. A guest row can be a couple or a family of five,
     and a caterer is quoting per plate — counting rows here would put a
     number on the cover that nobody can order food against. */
  const coming = guestRows.filter((g) => g.status === 'coming');
  const heads = coming.reduce((n, g) => n + (Number(g.party_size) || 0), 0);

  const dietCounts = new Map<string, number>();
  for (const g of coming) {
    if (g.diet && g.diet !== 'none') {
      dietCounts.set(g.diet, (dietCounts.get(g.diet) ?? 0) + (Number(g.party_size) || 0));
    }
  }

  const daysToEvent = client.event_date
    ? daysBetween(todayInZone(), client.event_date)
    : null;

  /* The same signals the dashboard reads, so the cover and the screen cannot
     tell a producer two different things about the same wedding. */
  const standing = standingOf({
    daysToEvent,
    hasVenue: Boolean(client.venue),
    hasBudgetTarget: payments.length > 0,
    vendorsBooked: vendors.filter((v) => v.status === 'booked').length,
    guestsInvited: guestRows.length,
    guestsAnswered: guestRows.filter((g) => g.status !== 'pending').length,
    scheduleItems: moments.length,
  });

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/clients/${id}`} className="btn-quiet inline-flex items-center gap-1.5 px-0 text-[14px]">
          <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
          {c.back}
        </Link>
        <PrintButton label={c.print} />
      </div>

      <ProductionBook
        c={c}
        locale={locale}
        client={client}
        brand={{ name: brand.name, tagline: brand.tagline || undefined }}
        standing={standing}
        daysToEvent={daysToEvent}
        guests={{
          invited: guestRows.length,
          coming: coming.length,
          declined: guestRows.filter((g) => g.status === 'declined').length,
          pending: guestRows.filter((g) => g.status === 'pending').length,
          heads,
          diets: [...dietCounts.entries()].map(([k, count]) => ({ label: k, count })),
        }}
        vendors={vendors}
        crew={crew}
        moments={moments}
        tasks={tasks}
        payments={payments}
      />
    </>
  );
}
