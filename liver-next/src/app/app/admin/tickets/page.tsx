import Link from 'next/link';
import { Check, ExternalLink, RotateCcw } from 'lucide-react';
import { requireRoot } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { safeRows } from '@/lib/safe';
import { PageHead, Empty } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { setTicketStatus } from '@/app/actions/tickets';
import { ticketCopy, appCopy } from '@/content/site';
import { Ltr } from '@/components/Ltr';

export const dynamic = 'force-dynamic';
export const metadata = { title: ticketCopy.admin.title };

const c = ticketCopy.admin;
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Ticket = {
  id: string; reporter_id: string | null; category: string; body: string; route: string;
  agent: string; screenshot_path: string | null; status: 'open' | 'closed'; created_at: string;
};

/**
 * What people reported from inside the platform, for the account that
 * answers. Open ones first, and the closed ones only on request, because the
 * closed ones are the record and the open ones are the work.
 */
export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireRoot();
  const showClosed = (await searchParams).all === '1';
  const sb = await supabaseServer();

  let q = sb.from('support_tickets')
    .select('id,reporter_id,category,body,route,agent,screenshot_path,status,created_at')
    .order('status').order('created_at', { ascending: false }).limit(200);
  if (!showClosed) q = q.eq('status', 'open');
  const tickets = await safeRows<Ticket>('tickets', q);

  /* Names for the reporters, through the profiles the root account may read. */
  const ids = Array.from(new Set(tickets.map((t) => t.reporter_id).filter((v): v is string => !!v)));
  const { data: people } = ids.length > 0
    ? await sb.from('profiles').select('id,full_name,email').in('id', ids)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));

  /* One signed link per screenshot, for an hour, which is how long a look takes. */
  const paths = tickets.map((t) => t.screenshot_path).filter((v): v is string => !!v);
  const shots = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await sb.storage.from('support').createSignedUrls(paths, 60 * 60);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) shots.set(s.path, s.signedUrl); });
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/app/admin" className="btn-quiet inline-block px-0 text-[14px]">← {appCopy.admin.title}</Link>
      </div>
      <PageHead title={c.title} sub={c.sub} />

      <div className="mb-5">
        <Link
          href={showClosed ? '/app/admin/tickets' : '/app/admin/tickets?all=1'}
          className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]"
        >
          {showClosed ? c.open : c.showClosed}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <Empty text={c.none} />
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className={`rounded-xl2 px-2 py-0.5 ${t.status === 'open' ? 'bg-warn-wash text-warn' : 'bg-ok-wash text-ok'}`}>
                      {t.status === 'open' ? c.open : c.closed}
                    </span>
                    <span className="text-ink-soft">{ticketCopy.categories[t.category as keyof typeof ticketCopy.categories] ?? t.category}</span>
                    <span className="text-ink-mute">·</span>
                    <span className="text-ink-mute">{dateFmt.format(new Date(t.created_at))}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{t.body}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] text-ink-mute sm:grid-cols-[auto_1fr]">
                    <dt>{c.reporter}</dt><dd className="text-ink-soft">{t.reporter_id ? (who.get(t.reporter_id) ?? '·') : '·'}</dd>
                    <dt>{c.route}</dt><dd className="text-ink-soft"><Ltr>{t.route || '·'}</Ltr></dd>
                    <dt>{c.agent}</dt><dd className="break-all text-ink-soft"><Ltr>{t.agent || '·'}</Ltr></dd>
                  </dl>
                  {t.screenshot_path && shots.get(t.screenshot_path) && (
                    <a
                      href={shots.get(t.screenshot_path)} target="_blank" rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"
                    >
                      <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
                      {c.screenshot}
                    </a>
                  )}
                </div>
                <form action={setTicketStatus}>
                  <input type="hidden" name="ticket_id" value={t.id} />
                  <input type="hidden" name="status" value={t.status === 'open' ? 'closed' : 'open'} />
                  <button type="submit" className={`${t.status === 'open' ? 'btn-primary' : 'btn-ghost'} min-h-[38px] px-3.5 text-[13.5px]`}>
                    {t.status === 'open'
                      ? <Check size={15} strokeWidth={1.5} aria-hidden />
                      : <RotateCcw size={15} strokeWidth={1.5} aria-hidden />}
                    {t.status === 'open' ? c.markClosed : c.reopen}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Live sources={[{ table: 'support_tickets' }]} />
    </>
  );
}
