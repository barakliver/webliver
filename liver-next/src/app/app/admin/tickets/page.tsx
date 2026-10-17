import Link from 'next/link';
import type { Locale } from '@/lib/locale';
import { Check, ExternalLink, RotateCcw } from 'lucide-react';
import { requireRoot } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { safeRows } from '@/lib/safe';
import { PageHead, Empty } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';
import { setTicketStatus } from '@/app/actions/tickets';
import { ticketCopy } from '@/content/site';
import { serverCopy } from '@/lib/serverLocale';
import { Ltr } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';
import { IssueReporter } from '@/components/app/IssueReporter';

export const dynamic = 'force-dynamic';
export const metadata = { title: ticketCopy.admin.title };

const c = ticketCopy.admin;
const dateFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Ticket = {
  id: string; reporter_id: string | null; category: string; body: string; route: string;
  agent: string; screenshot_path: string | null; status: 'open' | 'closed'; created_at: string;
};

/**
 * What people reported from inside the platform, for the account that
 * answers. Open ones first, and the closed ones only on request, because the
 * closed ones are the record and the open ones are the work.
 */
export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ all?: string; t?: string }> }) {
  const locale = (await serverCopy()).locale;
  const ui = await serverCopy();
  const account = await requireRoot();
  const sp = await searchParams;
  const showClosed = sp.all === '1';
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
        <Link href="/app/admin" className="btn-quiet inline-block px-0 text-body">← {ui.admin.title}</Link>
      </div>
      <PageHead title={c.title} sub={c.sub}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />

      {/* Open or all, as one control with two sides. */}
      <div className="mb-5 inline-flex gap-1 rounded-full bg-surface-200 p-1" role="group">
        {[{ on: !showClosed, href: '/app/admin/tickets', label: c.open }, { on: showClosed, href: '/app/admin/tickets?all=1', label: c.showClosed }].map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.on ? 'true' : undefined}
            className={`inline-flex min-h-[40px] items-center rounded-full px-5 text-body transition-colors duration-touch ${t.on ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Empty text={c.none} />
      ) : (() => {
        /* The list and the open report side by side from a laptop up; on a
           phone the list, and a press opens the report with a way back. The
           choice is in the address, so it survives a reload and can be sent. */
        const picked = tickets.find((t) => t.id === sp.t) ?? null;
        const current = picked ?? tickets[0];
        const href = (id: string) => `/app/admin/tickets?${showClosed ? 'all=1&' : ''}t=${id}`;
        const back = `/app/admin/tickets${showClosed ? '?all=1' : ''}`;
        return (
          <div className="lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-7">
            <ul className={`m-0 list-none space-y-1 p-0 ${picked ? 'hidden lg:block' : ''}`}>
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={href(t.id)} aria-current={t.id === current.id ? 'true' : undefined}
                    className={`block rounded-card px-4 py-3.5 transition-colors duration-touch ${t.id === current.id ? 'lg:bg-card' : 'hover:bg-surface-100'}`}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="line-clamp-1 text-lead text-ink">{t.body}</span>
                      <span className="shrink-0 text-micro text-ink-mute">{dateFmtFor(locale).format(new Date(t.created_at))}</span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-3 text-meta">
                      <span className="truncate text-ink-mute"><Ltr>{t.route || '·'}</Ltr></span>
                      <span className={t.status === 'open' ? 'text-accent' : 'text-ok'}>{t.status === 'open' ? c.open : c.closed}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <article key={current.id} className={`card ${picked ? '' : 'hidden lg:block'}`}>
              <Link href={back} className="btn-quiet mb-3 inline-block px-0 text-body lg:hidden">← {c.open}</Link>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-meta">
                    <span className={`rounded-full px-2.5 py-0.5 ${current.status === 'open' ? 'bg-accent-wash text-accent' : 'bg-ok-wash text-ok'}`}>
                      {current.status === 'open' ? c.open : c.closed}
                    </span>
                    <span className="text-ink-soft">{ticketCopy.categories[current.category as keyof typeof ticketCopy.categories] ?? current.category}</span>
                    <span className="text-ink-mute">·</span>
                    <span className="text-ink-mute">{dateFmtFor(locale).format(new Date(current.created_at))}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap font-display text-subhead font-light leading-relaxed text-ink">{current.body}</p>
                  <dl className="mt-4 grid gap-x-6 gap-y-1 text-meta text-ink-mute sm:grid-cols-[auto_1fr]">
                    <dt>{c.reporter}</dt><dd className="text-ink-soft">{current.reporter_id ? (who.get(current.reporter_id) ?? '·') : '·'}</dd>
                    <dt>{c.route}</dt><dd className="text-ink-soft"><Ltr>{current.route || '·'}</Ltr></dd>
                    <dt>{c.agent}</dt><dd className="break-all text-ink-soft"><Ltr>{current.agent || '·'}</Ltr></dd>
                  </dl>
                  {current.screenshot_path && shots.get(current.screenshot_path) && (
                    <a
                      href={shots.get(current.screenshot_path)} target="_blank" rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-body text-accent hover:underline"
                    >
                      <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
                      {c.screenshot}
                    </a>
                  )}
                </div>
                <form action={setTicketStatus}>
                  <input type="hidden" name="ticket_id" value={current.id} />
                  <input type="hidden" name="status" value={current.status === 'open' ? 'closed' : 'open'} />
                  <button type="submit" className={`${current.status === 'open' ? 'btn-primary' : 'btn-ghost'} min-h-[38px] px-3.5 text-body`}>
                    {current.status === 'open'
                      ? <Check size={15} strokeWidth={1.5} aria-hidden />
                      : <RotateCcw size={15} strokeWidth={1.5} aria-hidden />}
                    {current.status === 'open' ? c.markClosed : c.reopen}
                  </button>
                </form>
              </div>
            </article>
          </div>
        );
      })()}
      <Live sources={[{ table: 'support_tickets' }]} />
    </>
  );
}
