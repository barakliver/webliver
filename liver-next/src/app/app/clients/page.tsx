import Link from 'next/link';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { NewClientForm } from '@/components/app/NewClientForm';

export const metadata = { title: appCopy.clients.title };

type ClientRow = {
  id: string; display_name: string; event_date: string | null;
  venue: string; guest_estimate: number | null;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default async function ClientsPage() {
  await requireLiveProducer();
  const sb = await supabaseServer();
  const { data } = await sb
    .from('clients')
    .select('id,display_name,event_date,venue,guest_estimate')
    .order('event_date', { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as ClientRow[];

  return (
    <>
      <PageHead title={appCopy.clients.title} sub={appCopy.clients.sub} />
      <div className="mb-8"><NewClientForm /></div>
      {rows.length === 0 ? (
        <Empty text={appCopy.clients.empty} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/app/clients/${c.id}`} className="card block transition-shadow hover:shadow-lift">
              <h2 className="font-display text-[19px] font-semibold text-ink">{c.display_name}</h2>
              <dl className="mt-4 space-y-1.5 text-[14.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">{appCopy.clients.cols.date}</dt>
                  <dd className="text-ink-soft">{c.event_date ? dateFmt.format(new Date(c.event_date)) : appCopy.clients.noDate}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">{appCopy.clients.cols.venue}</dt>
                  <dd className="text-ink-soft">{c.venue || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">{appCopy.clients.cols.guests}</dt>
                  <dd className="text-ink-soft">{c.guest_estimate ?? '—'}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
      <Live sources={[{ table: 'clients' }]} />
    </>
  );
}
