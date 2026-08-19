import { requireRoot } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { setProducerStatus } from '@/app/actions/admin';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';

export const metadata = { title: appCopy.admin.title };

type ProducerRow = {
  id: string; brand_name: string; contact_name: string; contact_email: string;
  status: keyof typeof appCopy.pending.statuses; created_at: string;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

function Action({ id, status, label, tone }: { id: string; status: string; label: string; tone: 'primary' | 'ghost' }) {
  return (
    <form action={setProducerStatus}>
      <input type="hidden" name="producer_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`${tone === 'primary' ? 'btn-primary' : 'btn-ghost'} px-4 py-2 text-[13.5px]`}>
        {label}
      </button>
    </form>
  );
}

export default async function AdminPage() {
  const account = await requireRoot();

  const sb = await supabaseServer();
  const { data } = await sb
    .from('producers')
    .select('id,brand_name,contact_name,contact_email,status,created_at')
    .order('created_at', { ascending: false });

  /* the root admin's own workspace is not something to approve or suspend */
  const rows = ((data ?? []) as ProducerRow[]).filter((p) => p.contact_email !== account.email);

  return (
    <>
      <PageHead title={appCopy.admin.title} sub={appCopy.admin.sub} />
      {rows.length === 0 ? (
        <Empty text={appCopy.admin.empty} />
      ) : (
        <div className="space-y-4">
          {rows.map((p) => (
            <article key={p.id} className="card flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-[18px] font-semibold text-ink">
                  {p.brand_name || p.contact_name || p.contact_email}
                </h2>
                <p className="mt-1 text-[14px] text-ink-soft" dir="ltr">{p.contact_email}</p>
                <p className="mt-1 text-[13px] text-ink-mute">
                  {appCopy.admin.cols.since}: {dateFmt.format(new Date(p.created_at))} ·{' '}
                  {appCopy.pending.statuses[p.status]}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.status !== 'approved' && <Action id={p.id} status="approved" label={appCopy.admin.approve} tone="primary" />}
                {p.status === 'approved' && <Action id={p.id} status="suspended" label={appCopy.admin.suspend} tone="ghost" />}
                {p.status === 'suspended' && <Action id={p.id} status="approved" label={appCopy.admin.restore} tone="primary" />}
                {p.status === 'pending' && <Action id={p.id} status="rejected" label={appCopy.admin.reject} tone="ghost" />}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
