import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { appCopy } from '@/content/site';
import { PageHead, Empty } from '@/components/app/PageHead';
import { PortalWorkspace, PORTAL_LIVE_SOURCES } from '@/components/app/PortalWorkspace';
import { loadPortal } from '@/lib/portal';

export const metadata = { title: appCopy.portal.title };

export default async function PortalPage() {
  const account = await requireAccount();
  const sb = await supabaseServer();

  /* asClient is true even though this reader *is* the client: it costs nothing
     here, and it means the gate is exercised on the path people actually use
     rather than only on the preview. */
  const data = await loadPortal(sb, { asClient: true });

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
          <PortalWorkspace key={w.id} workspace={w} data={data} viewerId={account.id} />
        ))}
      </div>
      <Live sources={PORTAL_LIVE_SOURCES} />
    </>
  );
}
