import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { currentLocale } from '@/lib/serverLocale';
import { PageHead, Empty } from '@/components/app/PageHead';
import { PortalWorkspace } from '@/components/app/PortalWorkspace';
import { PORTAL_LIVE_SOURCES } from '@/lib/liveSources';
import { loadPortal, loadThread, loadContracts } from '@/lib/portal';
import { loadFiles } from '@/lib/files';
import { loadEventFile } from '@/lib/eventFile';
import { Contracts } from '@/components/app/Contracts';
import { EventFiles } from '@/components/app/EventFiles';
import { EventFileLists } from '@/components/app/EventFileLists';
import { Thread } from '@/components/app/Thread';
import { PortalActions } from '@/components/app/PortalActions';
import { fileReport } from '@/app/actions/report';
import { brandFor } from '@/lib/branding';
import { Ltr } from '@/components/Ltr';

export async function generateMetadata() {
  return { title: appUiFor(await currentLocale()).portal.title };
}

export default async function PortalPage() {
  const account = await requireAccount();
  const sb = await supabaseServer();

  /* The couple's own language. Everything below reads its words from here, and
     the panels read theirs from the provider, so one cookie decides the whole
     screen instead of half of it. */
  const ui = appUiFor(await currentLocale());

  /* asClient is true even though this reader *is* the client: it costs nothing
     here, and it means the gate is exercised on the path people actually use
     rather than only on the preview. */
  const data = await loadPortal(sb, { asClient: true });
  /* Whose business this couple is inside. The two floating actions reach a
     person, so they have to reach the right one. */
  const brand = await brandFor(account);
  const ids = data.workspaces.map((w) => w.id);
  const [threads, contracts, files] = await Promise.all([
    loadThread(sb, ids), loadContracts(sb, ids), loadFiles(sb, ids),
  ]);

  /* The songs and the personal details are the couple's to fill in — they are
     the ones who know what she likes to drink and who is walking her in. Read
     per workspace rather than in one go, because a couple has one event and
     the loop below already has the id. */
  const eventFiles = new Map(
    await Promise.all(ids.map(async (id) => [id, await loadEventFile(sb, id)] as const))
  );

  if (data.workspaces.length === 0) {
    return (
      <>
        <PageHead title={ui.portal.title} sub={ui.portal.sub} />
        <Empty text={ui.portal.empty} />
        {/* Almost every empty area is an address mismatch rather than an event
            that has not been opened. Since Google made signing in with the
            wrong one a single tap, the address is named here and the fix is
            spelled out, rather than leaving somebody looking at a blank page
            wondering whether the invitation was real. */}
        <div className="card mt-5">
          <p className="text-[14.5px] text-ink">
            <Ltr>{ui.portal.emptyWho.replace('{email}', account.email)}</Ltr>
          </p>
          <p className="mt-2 text-[14px] text-ink-soft">{ui.portal.emptyMismatch}</p>
        </div>
      </>
    );
  }

  /* One provider over the whole screen. Every panel below is a client
     component, and the alternative was threading the same prop through
     thirteen of them and through the producer's console on the way. The
     context defaults to Hebrew, so a screen that never gets a provider
     renders exactly what it rendered before. */
  return (
    <CopyProvider value={ui}>
      <PageHead title={ui.portal.title} sub={ui.portal.sub} />
      <div className="space-y-6">
        {data.workspaces.map((w) => (
          <div key={w.id} className="space-y-6">
            <PortalWorkspace workspace={w} data={data} viewerId={account.id} ui={ui} />
            <Contracts clientId={w.id} contracts={contracts.get(w.id) ?? []} viewer="client" />
            {/* Behind the same gate every other module is behind, so a plan
                that does not include it does not quietly include it here. */}
            {data.can(w.id, 'files') && (
              <EventFiles clientId={w.id} files={files.get(w.id) ?? []} viewer="client" />
            )}
            {/* Theirs to fill in. The equipment is read only for them — it is
                the producer's logistics — and the component knows that. */}
            <EventFileLists
              clientId={w.id}
              songs={eventFiles.get(w.id)?.songs ?? []}
              kit={eventFiles.get(w.id)?.kit ?? []}
              people={eventFiles.get(w.id)?.people ?? []}
              viewer="client"
            />
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
    </CopyProvider>
  );
}
