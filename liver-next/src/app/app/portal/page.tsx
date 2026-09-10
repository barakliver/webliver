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
import { IssueReporter } from '@/components/app/IssueReporter';
import { ticketFor, prepFor, venuesFor } from '@/content/appUi';
import { PrepSheet } from '@/components/app/PrepSheet';
import { loadPrep, prepOf } from '@/lib/prep';
import { VenueCompare } from '@/components/app/VenueCompare';
import { loadVenues, venuesOf } from '@/lib/venueRows';
import { publicEnv } from '@/lib/env';
import { EventSelector } from '@/components/portal/EventSelector';
import { loadEnvelopes, envelopesOf } from '@/lib/envelopes';
import { loadVehicles, vehiclesOf } from '@/lib/vehicles';
import { EnvelopesPanel } from '@/components/app/EnvelopesPanel';
import { VehiclesPanel } from '@/components/app/VehiclesPanel';
import { CalendarFeed } from '@/components/app/CalendarFeed';
import { VendorHq } from '@/components/app/VendorHq';
import { envelopesFor, vehiclesFor } from '@/content/appUi';

export async function generateMetadata() {
  return { title: appUiFor(await currentLocale()).portal.title };
}

export default async function PortalPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const account = await requireAccount();
  const sb = await supabaseServer();

  /* Which celebration is open. It lives in the address so the henna and the
     wedding can be two tabs, and so the filtering below happens here rather
     than in the browser. Trusted only as far as the next few lines: it is
     matched against the events this reader may actually read, and anything
     else falls back to the first. */
  const wanted = (await searchParams).event;
  const openEventId = typeof wanted === 'string' ? wanted : null;

  /* The couple's own language. Everything below reads its words from here, and
     the panels read theirs from the provider, so one cookie decides the whole
     screen instead of half of it. */
  const locale = await currentLocale();
  const ui = appUiFor(locale);

  /* asClient is true even though this reader *is* the client: it costs nothing
     here, and it means the gate is exercised on the path people actually use
     rather than only on the preview. */
  const data = await loadPortal(sb, { asClient: true });
  /* Whose business this couple is inside. The two floating actions reach a
     person, so they have to reach the right one. */
  const brand = await brandFor(account);
  const ids = data.workspaces.map((w) => w.id);
  const [threads, contracts, files, prep, envelopes, vehicles] = await Promise.all([
    loadThread(sb, ids), loadContracts(sb, ids), loadFiles(sb, ids), loadPrep(sb, ids),
    loadEnvelopes(sb, ids), loadVehicles(sb, ids),
  ]);
  const halls = await loadVenues(sb, ids);

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
        <PageHead title={ui.portal.title} sub={ui.portal.sub}
          report={<IssueReporter userId={account.id} context={ui.portal.title} copy={ticketFor(locale)} />}
        />
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
      <PageHead title={ui.portal.title} sub={ui.portal.sub}
          report={<IssueReporter userId={account.id} context={ui.portal.title} copy={ticketFor(locale)} />}
        />
      <div className="space-y-6">
        {data.workspaces.map((w) => {
          const sheet = prepOf(prep, w.id);
          const venues = venuesOf(halls, w.id);
          /* An address naming an event on somebody else's workspace, or one
             that has since been deleted, resolves to nothing here and the
             workspace falls back to its first celebration — rather than to a
             checklist that is empty because the filter matched no rows. */
          const events = data.eventsFor(w.id);
          const openEvent = events.find((e) => e.id === openEventId) ?? events[0] ?? null;
          const envs = envelopesOf(envelopes, w.id);
          const cars = vehiclesOf(vehicles, w.id);
          return (
            <div key={w.id} className="space-y-6">
              {data.can(w.id, 'events') && events.length > 0 && (
                <EventSelector
                  clientId={w.id}
                  events={events}
                  selectedId={openEvent?.id ?? null}
                  labels={{ add: ui.portal.eventAdd, empty: ui.portal.eventPick }}
                />
              )}
              <PortalWorkspace
                workspace={w} data={data} viewerId={account.id} ui={ui}
                currentEventId={openEvent?.id}
                extra={{
                  contracts: (contracts.get(w.id) ?? []).length,
                  venues: venues.venues.length,
                  files: (files.get(w.id) ?? []).length,
                  envelopes: envs.length,
                  vehicles: cars.length,
                }}
              />
              {data.can(w.id, 'vendors') && data.vendorsFor(w.id).length > 0 && (
                <div id="vendorhq" className="scroll-mt-28"><VendorHq
                  clientId={w.id} viewer="client"
                  vendors={data.vendorsFor(w.id)}
                  contracts={(contracts.get(w.id) ?? []).map((k) => ({ party_name: k.party_name ?? '', status: k.status, signed_at: k.signed_at }))}
                  lines={data.budgetFor(w.id).map((b) => ({ event_vendor_id: (b as { event_vendor_id?: string | null }).event_vendor_id ?? null, estimate: b.estimate, agreed: b.agreed }))}
                  couple={w.display_name} date={w.event_date} signAs={brand.name}
                /></div>
              )}
              {data.can(w.id, 'contracts') && (
                <div id="contracts" className="scroll-mt-28"><Contracts clientId={w.id} contracts={contracts.get(w.id) ?? []} viewer="client" /></div>
              )}
              {/* While the hall is still open, or once there is something to
                  compare. Gating it on the halls alone was wrong in the way that
                  only shows up from the couple's side: they are the ones touring
                  venues, and a panel that appears only after somebody else has
                  added one is a panel they can never start. Gating it on nothing
                  is wrong the other way — a comparison on the screen of a couple
                  whose hall was booked a year ago is a panel asking them to redo
                  a decision they have made. */}
              {data.can(w.id, 'venues') && (venues.venues.length > 0 || !w.venue) && (
                <div id="venues" className="scroll-mt-28"><VenueCompare
                  c={venuesFor(locale)}
                  clientId={w.id}
                  venues={venues.venues}
                  quoteUrls={venues.quoteUrls}
                  guestEstimate={w.guest_estimate ?? 0}
                /></div>
              )}
              {/* Behind the same gate every other module is behind, so a plan
                  that does not include it does not quietly include it here. */}
              {data.can(w.id, 'files') && (
                <div id="files" className="scroll-mt-28"><EventFiles clientId={w.id} files={files.get(w.id) ?? []} viewer="client" /></div>
              )}
              {/* Theirs to fill in. The equipment is read only for them — it is
                  the producer's logistics — and the component knows that. */}
              {data.can(w.id, 'lists') && (
                <div id="lists" className="scroll-mt-28"><EventFileLists
                  clientId={w.id}
                  songs={eventFiles.get(w.id)?.songs ?? []}
                  kit={eventFiles.get(w.id)?.kit ?? []}
                  people={eventFiles.get(w.id)?.people ?? []}
                  viewer="client"
                /></div>
              )}
              {/* The same panel the producer has on the event file, not a
                  read-only copy of it. Who the aunt is and what the dress
                  should look like are things only the couple knows, and a
                  screen where they can see the roster but not fix a name is a
                  screen that sends them back to WhatsApp — which is the
                  conversation this whole module exists to end. */}
              {data.can(w.id, 'prep') && (
                <div id="prep" className="scroll-mt-28"><PrepSheet
                  c={prepFor(locale)}
                  clientId={w.id}
                  vips={sheet.vips}
                  looks={sheet.looks}
                  shares={sheet.shares}
                  siteUrl={publicEnv.siteUrl}
                /></div>
              )}
              {/* The two lists the event manager needs in hand on the night.
                  Written by either side, gated like everything else. */}
              {data.can(w.id, 'envelopes') && (
                <div id="envelopes" className="scroll-mt-28"><EnvelopesPanel c={envelopesFor(locale)} clientId={w.id} items={envs} /></div>
              )}
              {data.can(w.id, 'transport') && (
                <div id="transport" className="scroll-mt-28"><VehiclesPanel c={vehiclesFor(locale)} clientId={w.id} items={cars} /></div>
              )}
              {data.can(w.id, 'messages') && (
                <div id="thread" className="scroll-mt-28"><Thread clientId={w.id} messages={threads.get(w.id) ?? []} viewerId={account.id} /></div>
              )}
              {/* Their deadlines and their day, in the calendar on their
                  phone, updating on its own. The link is a credential and
                  the card says so. */}
              <div id="calendar" className="scroll-mt-28"><CalendarFeed clientId={w.id} /></div>
            </div>
          );
        })}
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
