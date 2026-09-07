import { formatDate } from '@/lib/dates';
import { Check, Ban, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ProducerRow } from '@/lib/directory';
import { setProducerStatus, setAccountKind } from '@/app/actions/admin';
import { appCopy } from '@/content/site';
import { EVENT_ZONE } from '@/lib/clock';

/**
 * One account on the platform, and the two decisions to be made about it.
 *
 * Its own file so it can be looked at. /app/admin is root only and behind a
 * real session, which means the one screen where the least reversible decision
 * in the product is made — what somebody is — was the one screen nobody could
 * open without being the owner of the platform, on a laptop, signed in.
 */

const c = appCopy.admin;
const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });

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

export function AdminRow({ p }: { p: ProducerRow }) {
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

      {!p.isRoot && p.ownerId && <KindSwitch ownerId={p.ownerId} role={p.ownerRole} />}
    </li>
  );
}

/**
 * Which of three things this account is.
 *
 * Under the approve buttons rather than beside them, because it is a different
 * question. Approving decides whether somebody may in; this decides what they
 * are — and getting that wrong is what made the approve buttons meaningless.
 * Everybody who signs up is guessed to be a producer, and roughly half those
 * guesses are wrong: approve a couple and she gets a client list, reject her
 * and she gets an account that opens onto nothing. Neither is what she is.
 *
 * Each choice says what will happen underneath it. These write a role and one
 * of them opens a workspace, and a button whose consequence has to be
 * remembered is a button somebody presses once to find out.
 */
function KindSwitch({ ownerId, role }: { ownerId: string; role: ProducerRow['ownerRole'] }) {
  const k = c.kind;
  const options = [
    { kind: 'producer', label: k.producer, note: k.producerNote, on: role !== 'client' },
    { kind: 'diy', label: k.diy, note: k.diyNote, on: false },
    { kind: 'managed', label: k.managed, note: k.managedNote, on: false },
  ];

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-[13.5px] font-medium text-ink">{k.title}</h4>
        <span className="text-[12.5px] text-ink-mute">
          {k.current}: {role === 'client' ? k.isClient : k.isProducer}
        </span>
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink-mute">{k.sub}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <form key={o.kind} action={setAccountKind}>
            <input type="hidden" name="owner_id" value={ownerId} />
            <input type="hidden" name="kind" value={o.kind} />
            {/* The one it already is is marked, not disabled. Pressing it
                again is harmless and sometimes the point: a producer whose row
                was rejected goes back to pending this way. */}
            <button
              type="submit"
              className={o.on
                ? 'w-full rounded-xl2 border border-accent bg-accent-wash p-3 text-start transition'
                : 'w-full rounded-xl2 border border-line p-3 text-start transition hover:border-accent/40 hover:bg-surface-200'}
            >
              <span className="block text-[13.5px] font-medium text-ink">{o.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-mute">{o.note}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
