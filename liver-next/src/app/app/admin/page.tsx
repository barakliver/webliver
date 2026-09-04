import { formatDate } from '@/lib/dates';
import { Check, Ban, RotateCcw, ShieldCheck, Lock, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { requireRoot, ROOT_ADMIN_EMAIL } from '@/lib/auth';
import { getConsole, type ProducerRow, type Stats } from '@/lib/directory';
import { setProducerStatus } from '@/app/actions/admin';
import { appCopy, ticketCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { Referrals, type ReferralRow } from '@/components/app/Referrals';
import { supabaseServer } from '@/lib/supabase/server';
import { safeRows } from '@/lib/safe';
import { publicEnv } from '@/lib/env';
import { FeatureFlags } from '@/components/app/FeatureFlags';
import { MetricBlock } from '@/components/app/Metric';
import { Live } from '@/components/app/Live';

export const dynamic = 'force-dynamic';
export const metadata = { title: appCopy.admin.title };

const c = appCopy.admin;
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

const STATUS_TONE: Record<ProducerRow['status'], string> = {
  approved:  'bg-ok-wash text-ok',
  pending:   'bg-warn-wash text-warn',
  suspended: 'bg-bad-wash text-bad',
  rejected:  'bg-surface-200 text-ink-mute',
};

function StatusButton({ id, status, label, tone }: {
  id: string; status: string; label: string; tone: 'primary' | 'ghost' | 'quiet';
}) {
  const Icon = status === 'approved' ? Check : status === 'pending' ? RotateCcw : Ban;
  return (
    <form action={setProducerStatus}>
      <input type="hidden" name="producer_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`btn-${tone} px-3.5 text-[13.5px]`}>
        <Icon size={15} aria-hidden strokeWidth={1.5} />
        {label}
      </button>
    </form>
  );
}

/** One number, and the thing it counts. The first row is the headline and
 *  gets the design's own metric size; the two under it are the qualifiers,
 *  because a user count without the active share is a vanity figure.
 *
 *  This used to set the headline at `text-[22px]`, which is why the console
 *  carried the right palette and still did not look like the design: the
 *  numbers were the smallest thing on a screen that is entirely numbers. */
function Band({ title, rows, href }: {
  title: string; rows: { label: string; value: number }[]; href?: string;
}) {
  const [lead, ...rest] = rows;
  return (
    <MetricBlock
      kicker={title}
      value={lead.value.toLocaleString('en-US')}
      sub={lead.label}
      href={href}
      rows={rest.map((r) => ({ label: r.label, value: r.value.toLocaleString('en-US'), href }))}
    />
  );
}

function Telemetry({ s }: { s: Stats }) {
  return (
    <section>
      <h2 className="eyebrow mb-3">{c.stats.title}</h2>
      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        <Band title={c.stats.users} rows={[
          { label: c.stats.users, value: s.usersTotal },
          { label: c.stats.active30, value: s.usersActive30d },
          { label: c.stats.neverSeen, value: s.usersNeverSeen },
        ]} />
        {/* The only figure on this screen with a list behind it, and the list
            is further down the same page. The rest are counts of things this
            console deliberately cannot open: 0030 took root's master key away,
            so there is no couple to click through to and saying otherwise
            with an arrow would be a promise the database refuses to keep. */}
        <Band href="#producers" title={c.stats.producers} rows={[
          { label: c.stats.approved, value: s.producersApproved },
          { label: c.stats.pending, value: s.producersPending },
          { label: c.stats.blocked, value: s.producersBlocked },
        ]} />
        <Band title={c.stats.couples} rows={[
          { label: c.stats.couples, value: s.couplesTotal },
          { label: c.stats.managed, value: s.couplesManaged },
          { label: c.stats.diy, value: s.couplesDiy },
        ]} />
        <Band title={c.stats.events} rows={[
          { label: c.stats.live, value: s.eventsLive },
          { label: c.stats.events, value: s.eventsTotal },
          { label: `${c.stats.leads} · ${c.stats.last30}`, value: s.leads30d },
        ]} />
      </div>
    </section>
  );
}

function Producer({ p }: { p: ProducerRow }) {
  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-[17.5px] font-semibold text-ink">
            {p.brand}
            {p.isRoot && (
              <span className="inline-flex items-center gap-1 rounded-xl2 bg-accent-wash px-2.5 py-0.5 text-[12px] font-medium text-accent">
                <ShieldCheck size={13} aria-hidden strokeWidth={1.5} />
                {c.rootBadge}
              </span>
            )}
            <span className={`rounded-xl2 px-2.5 py-0.5 text-[12px] font-medium ${STATUS_TONE[p.status]}`}>
              {appCopy.pending.statuses[p.status]}
            </span>
          </h3>

          <p className="mt-1.5 text-[14px] text-ink-soft" dir="ltr">{p.email}</p>

          <p className="mt-1 text-[13px] text-ink-mute">
            {p.eventsLive} {p.eventsLive === 1 ? c.oneLive : c.manyLive}
            {p.eventsTotal !== p.eventsLive && ` · ${c.ofTotal} ${p.eventsTotal}`}
            {' · '}{c.board.leads} {p.leadsTotal}
            {' · '}{c.board.signed} {p.signedTotal}
          </p>

          <p className="mt-0.5 text-[13px] text-ink-mute">
            {p.lastSeen ? `${c.lastSeen} ${formatDate(dateFmt, p.lastSeen, '·')}` : c.never}
          </p>
        </div>

        {/* The root account gets no buttons at all. Approving yourself is
            meaningless and suspending yourself is a locked door with the key
            inside. */}
        {!p.isRoot && (
          <div className="flex flex-wrap gap-2">
            {p.status !== 'approved' && <StatusButton id={p.id} status="approved" label={c.approve} tone="primary" />}
            {p.status === 'pending' && <StatusButton id={p.id} status="rejected" label={c.reject} tone="quiet" />}
            {p.status === 'approved' && <StatusButton id={p.id} status="suspended" label={c.suspend} tone="quiet" />}
            {p.status === 'suspended' && <StatusButton id={p.id} status="approved" label={c.restore} tone="ghost" />}
          </div>
        )}
      </div>
    </li>
  );
}

export default async function AdminPage() {
  const account = await requireRoot();
  const { stats, producers, flags } = await getConsole(ROOT_ADMIN_EMAIL);

  /* Counts and brand names, which is the whole of what crosses this boundary.
     Allowed to fail on its own: a referral table that will not load is one
     panel missing, not a console that will not open. */
  const sb = await supabaseServer();
  const referrals = await safeRows<ReferralRow>('referrals', sb.rpc('referral_stats'));
  const mine = referrals.find((r) => r.producer_id === account.producer?.id)?.referral_code ?? null;

  const waiting = producers.filter((p) => p.status === 'pending');
  const rest = producers.filter((p) => p.status !== 'pending');

  return (
    <>
      <PageHead title={c.title} sub={c.sub}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />

      <div className="space-y-8">
        {stats ? <Telemetry s={stats} /> : <Empty text={c.statsFailed} />}

        {/* Ahead of everything, because an account waiting for approval is the
            only thing on this screen that is costing somebody time right now. */}
        {waiting.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">{c.waiting} · {waiting.length}</h2>
            <ul className="list-none space-y-3 p-0">
              {waiting.map((p) => <Producer key={p.id} p={p} />)}
            </ul>
          </section>
        )}

        <section id="producers" className="scroll-mt-8">
          <h2 className="eyebrow mb-1">{c.board.title}</h2>
          <p className="mb-3 text-[13.5px] text-ink-soft">{c.board.sub}</p>
          {rest.length === 0 ? (
            <Empty text={c.empty} />
          ) : (
            <ul className="list-none space-y-3 p-0">
              {rest.map((p) => <Producer key={p.id} p={p} />)}
            </ul>
          )}
        </section>

        <Referrals rows={referrals} siteUrl={publicEnv.siteUrl} mine={mine} />

        {/* What people reported from inside the platform. Its own screen,
            because a list of bugs under a list of producers is two lists. */}
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
              <LifeBuoy size={17} strokeWidth={1.5} aria-hidden />
              {ticketCopy.admin.title}
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-soft">{ticketCopy.admin.sub}</p>
          </div>
          <Link href="/app/admin/tickets" className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]">{ticketCopy.admin.title}</Link>
        </section>

        <FeatureFlags flags={flags} />

        {/* The screen says out loud what it cannot show. An empty list where a
            list used to be reads as a bug; a paragraph reads as a decision. */}
        <section className="card">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <Lock size={16} aria-hidden strokeWidth={1.5} />
            {c.privacy.title}
          </h2>
          <ul className="mt-2 list-none space-y-1.5 p-0 text-[14px] text-ink-soft">
            {c.privacy.body.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      </div>

      <Live sources={[{ table: 'producers' }]} />
    </>
  );
}
