import { Lock, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { requireRoot, ROOT_ADMIN_EMAIL } from '@/lib/auth';
import { getConsole, type Stats } from '@/lib/directory';
import { AdminRow } from '@/components/app/AdminRow';
import { AccountSearch } from '@/components/app/AccountSearch';
import { Fold } from '@/components/Fold';
import { FoldReveal } from '@/components/portal/FoldReveal';

import { ticketCopy } from '@/content/site';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead, Empty } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { Referrals, type ReferralRow } from '@/components/app/Referrals';
import { supabaseServer } from '@/lib/supabase/server';
import { safeRows } from '@/lib/safe';
import { publicEnv } from '@/lib/env';
import { FeatureFlags } from '@/components/app/FeatureFlags';
import { MetricBlock } from '@/components/app/Metric';
import { Live } from '@/components/app/Live';
import { ReleaseState } from '@/components/app/ReleaseState';
import { readReleaseState } from '@/lib/releaseFs';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).admin.title };
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

async function Telemetry({ s }: { s: Stats }) {
  const ui = await serverCopy();
  const c = ui.admin;
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

export default async function AdminPage() {
  const ui = await serverCopy();
  const c = ui.admin;
  const account = await requireRoot();
  const { stats, producers, flags } = await getConsole(ROOT_ADMIN_EMAIL);

  /* Counts and brand names, which is the whole of what crosses this boundary.
     Allowed to fail on its own: a referral table that will not load is one
     panel missing, not a console that will not open. */
  const sb = await supabaseServer();
  const referrals = await safeRows<ReferralRow>('referrals', sb.rpc('referral_stats'));
  const mine = referrals.find((r) => r.producer_id === account.producer?.id)?.referral_code ?? null;

  /* The release agent's own files, read from this machine. On the droplet
     they say whether the last release went live; anywhere else the card
     says there is no agent here. */
  const release = await readReleaseState();

  const waiting = producers.filter((p) => p.status === 'pending');
  const rest = producers.filter((p) => p.status !== 'pending');

  return (
    <>
      <PageHead title={c.title} sub={c.sub}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />

      {/* Seven sections, each of them a whole screen's worth, and the page is
          read for one thing at a time — almost always whether a release went
          up. So two things are open and the rest are rows that say what is
          behind them.

          The release card is first now, and it was sixth. It is the answer to
          the question this screen gets asked most, and it was under four
          blocks of numbers, a list of fifteen accounts and two panels. */}
      <div className="space-y-3">
        {/* Ahead of everything, because an account waiting for approval is the
            only thing on this screen that is costing somebody time right now.
            Never folded: a queue behind a closed row is a queue nobody
            empties. */}
        {waiting.length > 0 && (
          <section className="mb-5">
            <h2 className="eyebrow mb-3">{c.waiting} · {waiting.length}</h2>
            <ul className="list-none space-y-3 p-0">
              {waiting.map((p) => <AdminRow key={p.id} p={p} />)}
            </ul>
          </section>
        )}

        <div className="mb-5">
          <ReleaseState state={release} />
        </div>

        {stats ? (
          <Fold id="fold-stats" title={c.stats.title} sub={c.stats.sub}>
            <Telemetry s={stats} />
          </Fold>
        ) : <Empty text={c.statsFailed} />}

        {/* The id stays on the fold, so the arrow on the producers figure
            still lands here — and FoldReveal below opens it on the way. */}
        <Fold id="producers" title={c.board.title} sub={c.board.sub}>
          {rest.length === 0 ? (
            <Empty text={c.empty} />
          ) : (
            <>
              <AccountSearch scope="account-list" />
              <ul id="account-list" className="list-none space-y-2 p-0">
                {rest.map((p) => <AdminRow key={p.id} p={p} />)}
              </ul>
            </>
          )}
        </Fold>

        <Fold id="fold-referrals" title={ui.referral.title} sub={ui.referral.sub}>
          <Referrals rows={referrals} siteUrl={publicEnv.siteUrl} mine={mine} bare />
        </Fold>

        {/* What people reported from inside the platform. Its own screen,
            because a list of bugs under a list of producers is two lists. */}
        <Fold id="fold-tickets" title={ticketCopy.admin.title} sub={ticketCopy.admin.sub}>
          <Link href="/app/admin/tickets" className="btn-ghost inline-flex min-h-[44px] items-center gap-2 px-3.5 text-[14px]">
            <LifeBuoy size={17} strokeWidth={1.5} aria-hidden />
            {ticketCopy.admin.title}
          </Link>
        </Fold>

        {flags.length > 0 && (
          <Fold id="fold-flags" title={ui.admin.flags.title} sub={ui.admin.flags.sub}>
            <FeatureFlags flags={flags} bare />
          </Fold>
        )}

        {/* The screen says out loud what it cannot show. An empty list where a
            list used to be reads as a bug; a paragraph reads as a decision. */}
        <Fold id="fold-privacy" title={c.privacy.title} sub={c.privacy.sub}>
          <ul className="list-none space-y-1.5 p-0 text-[14px] text-ink-soft">
            {c.privacy.body.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </Fold>
      </div>

      {/* The arrow on the producers figure points into a folded section. */}
      <FoldReveal />

      <Live sources={[{ table: 'producers' }]} />
    </>
  );
}
