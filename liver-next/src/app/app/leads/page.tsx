import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy, EVENT_KINDS } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';

export const metadata = { title: appCopy.leads.title };

type LeadRow = {
  id: string; full_name: string; email: string; phone: string;
  kind: 'wedding' | 'corporate'; event_date: string | null;
  guest_count: number | null; status: keyof typeof appCopy.leads.statuses;
  created_at: string;
};

const kindLabel = (k: string) => EVENT_KINDS.find((e) => e.value === k)?.label ?? k;

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const showDate = (d: string | null) => (d ? dateFmt.format(new Date(d)) : '—');

export default async function LeadsPage() {
  await requireLiveProducer();
  const sb = await supabaseServer();
  const { data } = await sb
    .from('leads')
    .select('id,full_name,email,phone,kind,event_date,guest_count,status,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as LeadRow[];

  return (
    <>
      <PageHead title={appCopy.leads.title} sub={appCopy.leads.sub} />
      {rows.length === 0 ? (
        <Empty text={appCopy.leads.empty} />
      ) : (
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[720px] text-right text-[14.5px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-mute">
                <th scope="col" className="p-4 font-medium">{appCopy.leads.cols.name}</th>
                <th scope="col" className="p-4 font-medium">{appCopy.leads.cols.contact}</th>
                <th scope="col" className="p-4 font-medium">{appCopy.leads.cols.event}</th>
                <th scope="col" className="p-4 font-medium">{appCopy.leads.cols.date}</th>
                <th scope="col" className="p-4 font-medium">{appCopy.leads.cols.guests}</th>
                <th scope="col" className="p-4 font-medium">{appCopy.leads.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="p-4 font-medium text-ink">{l.full_name}</td>
                  <td className="p-4 text-ink-soft" dir="ltr">
                    <div>{l.phone || '—'}</div>
                    <div className="text-[13px] text-ink-mute">{l.email || ''}</div>
                  </td>
                  <td className="p-4 text-ink-soft">{kindLabel(l.kind)}</td>
                  <td className="p-4 text-ink-soft">{showDate(l.event_date)}</td>
                  <td className="p-4 text-ink-soft">{l.guest_count ?? '—'}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-azure-50 px-3 py-1 text-[13px] font-medium text-azure-600">
                      {appCopy.leads.statuses[l.status] ?? l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
