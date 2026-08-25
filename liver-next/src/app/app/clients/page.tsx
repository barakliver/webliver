import Link from 'next/link';
import { requireLiveProducer } from '@/lib/auth';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { NewClientForm } from '@/components/app/NewClientForm';
import { StatusBoard } from '@/components/app/StatusBoard';
import { Live } from '@/components/app/Live';
import { getBoard } from '@/lib/status';

export const metadata = { title: appCopy.clients.title };

const c = appCopy.statusBoard;

export default async function ClientsPage({
  searchParams,
}: { searchParams: Promise<{ show?: string }> }) {
  await requireLiveProducer();
  const { show } = await searchParams;
  const archived = show === 'done';

  const items = await getBoard({ archived });
  const openGaps = items.reduce((n, s) => n + s.gaps.length, 0);

  return (
    <>
      <PageHead
        title={appCopy.clients.title}
        sub={
          archived
            ? undefined
            : openGaps > 0
              ? `${openGaps} ${openGaps === 1 ? 'פער פתוח' : 'פערים פתוחים'} על פני ${items.length} ${items.length === 1 ? 'אירוע' : 'אירועים'}`
              : appCopy.clients.sub
        }
      />

      {/* Two lists, not a filter menu: live work and closed files are different
          questions, and one of them is asked far more often than the other. */}
      <nav className="mb-6 inline-flex rounded-full border border-line bg-ivory-100 p-1 text-[14px]" aria-label={appCopy.clients.title}>
        {[
          { key: 'live', href: '/app/clients', label: c.tabLive, on: !archived },
          { key: 'done', href: '/app/clients?show=done', label: c.tabDone, on: archived },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.on ? 'page' : undefined}
            className={`min-h-[36px] rounded-full px-4 leading-[36px] transition ${
              t.on ? 'bg-white font-medium text-ink shadow-soft' : 'text-ink-mute hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!archived && <div className="mb-8"><NewClientForm /></div>}

      {items.length === 0 ? (
        <Empty text={archived ? c.emptyDone : appCopy.clients.empty} />
      ) : (
        <>
          {!archived && openGaps === 0 && (
            <p className="mb-4 rounded-2xl bg-ok-wash px-4 py-3 text-[14.5px] text-ok">{c.allClear}</p>
          )}
          <StatusBoard items={items} />
        </>
      )}

      <Live sources={[
        { table: 'clients' }, { table: 'tasks' }, { table: 'payments' },
        { table: 'guests_rsvp' }, { table: 'day_schedule' },
        { table: 'client_authorized_emails' },
      ]} />
    </>
  );
}
