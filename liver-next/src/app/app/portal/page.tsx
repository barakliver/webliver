import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';

export const metadata = { title: appCopy.portal.title };

type Workspace = {
  id: string; display_name: string; event_date: string | null;
  venue: string; guest_estimate: number | null;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Whole days from today to the event, counted on calendar dates so a late
 *  evening visit does not shave a day off the countdown. */
function daysUntil(iso: string): number {
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(iso);
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export default async function PortalPage() {
  await requireAccount();
  const sb = await supabaseServer();
  const { data } = await sb
    .from('clients')
    .select('id,display_name,event_date,venue,guest_estimate')
    .order('event_date', { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as Workspace[];
  if (rows.length === 0) {
    return (
      <>
        <PageHead title={appCopy.portal.title} sub={appCopy.portal.sub} />
        <Empty text={appCopy.portal.empty} />
      </>
    );
  }

  return (
    <>
      <PageHead title={appCopy.portal.title} sub={appCopy.portal.sub} />
      <div className="space-y-6">
        {rows.map((c) => {
          const left = c.event_date ? daysUntil(c.event_date) : null;
          return (
            <article key={c.id} className="card">
              <h2 className="font-display text-[26px] font-semibold text-ink">{c.display_name}</h2>
              <p className="mt-2 text-[15.5px] text-ink-soft">
                {c.event_date ? dateFmt.format(new Date(c.event_date)) : appCopy.portal.dateTbd}
                {c.venue ? ` · ${c.venue}` : ''}
              </p>
              {left !== null && left >= 0 && (
                <div className="mt-6 flex items-baseline gap-2.5">
                  <span className="font-display text-[44px] font-semibold leading-none text-ink">{left}</span>
                  <span className="text-[15px] text-ink-mute">{appCopy.portal.daysLeft}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
