import Link from 'next/link';
import { Users, HeartHandshake, Check, Ban, RotateCcw, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { requireRoot } from '@/lib/auth';
import { getDirectory, type ProducerRow, type ClientRow } from '@/lib/directory';
import { setProducerStatus, reassignClient } from '@/app/actions/admin';
import { appCopy, EVENT_KINDS } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { Live } from '@/components/app/Live';

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
      <button
        type="submit"
        className={`btn-${tone} inline-flex items-center gap-1.5 px-3.5 py-2 text-[13.5px]`}
      >
        <Icon size={15} aria-hidden strokeWidth={1.75} />
        {label}
      </button>
    </form>
  );
}

function Producer({ p }: { p: ProducerRow }) {
  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-[17.5px] font-semibold text-ink">
            {p.brandName || p.contactName || p.email}
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
            {p.liveClients} {p.liveClients === 1 ? c.oneLive : c.manyLive}
            {p.totalClients !== p.liveClients && ` · ${c.ofTotal} ${p.totalClients}`}
            {' · '}{c.cols.since} {dateFmt.format(new Date(p.createdAt))}
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

function Client({ k, producers }: { k: ClientRow; producers: ProducerRow[] }) {
  const kind = EVENT_KINDS.find((e) => e.value === k.kind)?.label ?? k.kind;
  const options = producers.filter((p) => p.status === 'approved');

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-[17.5px] font-semibold text-ink">
            <Link href={`/app/clients/${k.id}`} className="transition hover:text-accent">{k.name}</Link>
            <span className="rounded-full bg-surface-200 px-2.5 py-0.5 text-[12px] text-ink-soft">{kind}</span>
            {k.archived && (
              <span className="rounded-full bg-surface-200 px-2.5 py-0.5 text-[12px] text-ink-mute">{c.archived}</span>
            )}
          </h3>

          {/* The relationship, stated rather than implied by which list the row
              is in. This is the question the screen exists to answer. */}
          <p className="mt-1.5 text-[14px] text-accent">
            {k.producerName ? `${c.assignedTo} ${k.producerName}` : c.unassigned}
          </p>

          <p className="mt-1 text-[13px] text-ink-mute">
            {k.eventDate ? dateFmt.format(new Date(k.eventDate)) : c.noDate}
          </p>

          {k.emails.length === 0 ? (
            <p className="mt-2.5 text-[13.5px] text-warn">{c.noEmails}</p>
          ) : (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {k.emails.map((e) => (
                <li
                  key={e.address}
                  dir="ltr"
                  className={`rounded-full px-2.5 py-1 text-[12.5px] ${
                    e.joined ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
                  }`}
                  title={e.joined ? c.joined : c.notJoined}
                >
                  {e.address}
                </li>
              ))}
            </ul>
          )}
        </div>

        {options.length > 1 && (
          <form action={reassignClient} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="client_id" value={k.id} />
            <ArrowLeftRight size={15} aria-hidden strokeWidth={1.75} className="text-ink-mute" />
            <select
              name="producer_id"
              defaultValue={k.producerId ?? ''}
              className="field w-[170px] py-1.5 text-[13.5px]"
              aria-label={c.reassign}
            >
              {options.map((p) => (
                <option key={p.id} value={p.id}>{p.brandName || p.contactName || p.email}</option>
              ))}
            </select>
            <button type="submit" className="btn-ghost px-3 py-1.5 text-[13px]">{c.reassign}</button>
          </form>
        )}
      </div>
    </li>
  );
}

export default async function AdminPage() {
  const account = await requireRoot();
  const { producers, clients } = await getDirectory(account.email);

  const waiting = producers.filter((p) => p.status === 'pending');
  const rest = producers.filter((p) => p.status !== 'pending');

  return (
    <>
      <PageHead title={c.title} sub={c.sub} />

      {/* Anything waiting on a decision comes first, and only exists when
          there is something to decide. */}
      {waiting.length > 0 && (
        <section className="mb-9">
          <h2 className="eyebrow mb-3">{c.waiting} · {waiting.length}</h2>
          <ul className="space-y-3.5">
            {waiting.map((p) => <Producer key={p.id} p={p} />)}
          </ul>
        </section>
      )}

      <section className="mb-9">
        <h2 className="eyebrow mb-3 flex items-center gap-2">
          <Users size={15} aria-hidden strokeWidth={1.75} />
          {c.producers} · {rest.length}
        </h2>
        {rest.length === 0 ? (
          <Empty text={c.empty} />
        ) : (
          <ul className="space-y-3.5">{rest.map((p) => <Producer key={p.id} p={p} />)}</ul>
        )}
      </section>

      <section>
        <h2 className="eyebrow mb-3 flex items-center gap-2">
          <HeartHandshake size={15} aria-hidden strokeWidth={1.75} />
          {c.clients} · {clients.length}
        </h2>
        {clients.length === 0 ? (
          <Empty text={c.noClients} />
        ) : (
          <ul className="space-y-3.5">
            {clients.map((k) => <Client key={k.id} k={k} producers={producers} />)}
          </ul>
        )}
      </section>

      <Live sources={[
        { table: 'producers' }, { table: 'clients' }, { table: 'client_authorized_emails' },
      ]} />
    </>
  );
}
