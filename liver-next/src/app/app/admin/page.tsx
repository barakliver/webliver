import { formatDate } from '@/lib/dates';
import { Check, Ban, RotateCcw, ShieldCheck, Lock } from 'lucide-react';
import { requireRoot, ROOT_ADMIN_EMAIL } from '@/lib/auth';
import { getConsole, type ProducerRow, type Stats } from '@/lib/directory';
import { setProducerStatus } from '@/app/actions/admin';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { FeatureFlags } from '@/components/app/FeatureFlags';
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
        <Icon size={15} aria-hidden strokeWidth={1.75} />
        {label}
      </button>
    </form>
  );
}

/** One number, and the thing it counts. Three to a card, because these are
 *  read as a set: a user count without the active share is a vanity figure. */
function Band({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <div className="card">
      <div className="text-[12.5px] font-semibold text-ink-mute">{title}</div>
      <div className="mt-2 space-y-1">
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <span className={i === 0 ? 'text-[14px] text-ink' : 'text-[13px] text-ink-soft'}>
              {r.label}
            </span>
            <span
              className={
                i === 0
                  ? 'font-display text-[22px] font-semibold tabular-nums text-ink'
                  : 'text-[15px] font-medium tabular-nums text-ink-soft'
              }
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Telemetry({ s }: { s: Stats }) {
  return (
    <section>
      <h2 className="eyebrow mb-3">{c.stats.title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Band title={c.stats.users} rows={[
          { label: c.stats.users, value: s.usersTotal },
          { label: c.stats.active30, value: s.usersActive30d },
          { label: c.stats.neverSeen, value: s.usersNeverSeen },
        ]} />
        <Band title={c.stats.producers} rows={[
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
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-wash px-2.5 py-0.5 text-[12px] font-medium text-accent">
                <ShieldCheck size={13} aria-hidden strokeWidth={2} />
                {c.rootBadge}
              </span>
            )}
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATUS_TONE[p.status]}`}>
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
  await requireRoot();
  const { stats, producers, flags } = await getConsole(ROOT_ADMIN_EMAIL);

  const waiting = producers.filter((p) => p.status === 'pending');
  const rest = producers.filter((p) => p.status !== 'pending');

  return (
    <>
      <PageHead title={c.title} sub={c.sub} />

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

        <section>
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

        <FeatureFlags flags={flags} />

        {/* The screen says out loud what it cannot show. An empty list where a
            list used to be reads as a bug; a paragraph reads as a decision. */}
        <section className="card">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <Lock size={16} aria-hidden strokeWidth={1.75} />
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
