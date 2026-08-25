import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { PortalWorkspace } from '@/components/app/PortalWorkspace';
import { PORTAL_LIVE_SOURCES } from '@/lib/liveSources';
import { loadPortal, loadThread, loadContracts } from '@/lib/portal';
import { Contracts } from '@/components/app/Contracts';
import { Thread } from '@/components/app/Thread';
import { PortalActions } from '@/components/app/PortalActions';
import { fileReport } from '@/app/actions/report';
import { brandFor } from '@/lib/branding';

export const metadata = { title: appCopy.portal.title };

export default async function PortalPage() {
  const account = await requireAccount();
  const sb = await supabaseServer();

  /* asClient is true even though this reader *is* the client: it costs nothing
     here, and it means the gate is exercised on the path people actually use
     rather than only on the preview. */
  const data = await loadPortal(sb, { asClient: true });
  /* Whose business this couple is inside. The two floating actions reach a
     person, so they have to reach the right one. */
  const brand = await brandFor(account);
  const ids = data.workspaces.map((w) => w.id);
  const [threads, contracts] = await Promise.all([loadThread(sb, ids), loadContracts(sb, ids)]);

  if (data.workspaces.length === 0) {
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
        {data.workspaces.map((w) => (
          <div key={w.id} className="space-y-6">
            <PortalWorkspace workspace={w} data={data} viewerId={account.id} />
            <Contracts clientId={w.id} contracts={contracts.get(w.id) ?? []} viewer="client" />
            <Thread clientId={w.id} messages={threads.get(w.id) ?? []} viewerId={account.id} />
          </div>
        ))}
      </div>

      {/* The two things wanted at a moment nobody plans for: reaching the
          producer, and saying something is wrong. Bound to the first
          workspace, which is the one the couple is looking at. */}
      <PortalActions
        producerName={brand.name}
        phone={brand.whatsapp}
        whatsapp={brand.whatsapp}
        bookingUrl={brand.bookingUrl}
        onReport={async (topic, body) => {
          'use server';
          return fileReport(data.workspaces[0].id, topic, body);
        }}
      />
      <Live sources={PORTAL_LIVE_SOURCES} />
    </>
  );
}
