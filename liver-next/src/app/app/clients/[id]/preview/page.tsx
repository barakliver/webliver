import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eye, ArrowRight } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { appCopy } from '@/content/site';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { currentLocale } from '@/lib/serverLocale';
import { PortalWorkspace } from '@/components/app/PortalWorkspace';
import { PORTAL_LIVE_SOURCES } from '@/lib/liveSources';
import { loadPortal } from '@/lib/portal';

export const metadata = { title: appCopy.preview.title };

/**
 * The couple's screen, seen by the producer.
 *
 * Nobody's session is swapped and no token is minted. The producer stays
 * themselves throughout — what changes is that the page reads on the couple's
 * behalf, so money that has not been shared does not arrive, exactly as it
 * would not arrive for them. That is the only place the two readers disagree
 * in this schema, and the gate lives in loadPortal() next to the query rather
 * than in this page, so it cannot be forgotten by the next screen that shows a
 * couple's data.
 *
 * Actions still work, and are still the producer's: ticking a task here is the
 * same act as ticking it on the workspace screen, recorded against the same
 * person. Nothing here lets a producer do something they could not already do
 * one click away — the point is seeing, not borrowing an identity.
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireLiveProducer();
  /* The same resolution the couple's own screen does, so a preview shows what
     they would see rather than what this page happened to compile with. */
  const ui = appUiFor(await currentLocale());
  const { id } = await params;

  const sb = await supabaseServer();
  const data = await loadPortal(sb, { clientId: id, asClient: true });
  const workspace = data.workspaces[0];
  if (!workspace) notFound();

  const c = appCopy.preview;

  return (
    <>
      {/* Fixed rather than scrolled away, because the entire risk of this
          screen is forgetting whose screen it is. */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-accent bg-surface-100/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2.5 text-[14.5px] text-accent">
            <Eye size={17} aria-hidden strokeWidth={1.5} />
            <span>
              <strong className="font-semibold">{c.banner}</strong>
              <span className="text-ink-soft"> · {workspace.display_name}</span>
            </span>
          </p>
          <Link
            href={`/app/clients/${id}`}
            className="inline-flex items-center gap-1.5 rounded-xl2 border border-accent/30 bg-card/70 px-3.5 py-1.5 text-[13.5px] font-medium text-accent transition hover:bg-card"
          >
            <ArrowRight size={15} aria-hidden strokeWidth={1.5} />
            {c.exit}
          </Link>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-mute">
          {workspace.budget_visible ? c.moneyShared : c.moneyHidden}
        </p>
      </div>

      <CopyProvider value={ui}>
        <PortalWorkspace workspace={workspace} data={data} viewerId={account.id} ui={ui} />
      </CopyProvider>
      <Live sources={PORTAL_LIVE_SOURCES} />
    </>
  );
}
