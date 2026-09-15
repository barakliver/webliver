import { requireAccount } from '@/lib/auth';
import Link from 'next/link';
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
import { WorkspaceSwitcher } from '@/components/portal/WorkspaceSwitcher';
import { PortalJump } from '@/components/portal/PortalJump';
import { FoldReveal } from '@/components/portal/FoldReveal';
import { pickWorkspace } from '@/lib/portalScope';
import { loadEnvelopes, envelopesOf } from '@/lib/envelopes';
import { loadVehicles, vehiclesOf } from '@/lib/vehicles';
import { EnvelopesPanel } from '@/components/app/EnvelopesPanel';
import { VehiclesPanel } from '@/components/app/VehiclesPanel';
import { CalendarFeed } from '@/components/app/CalendarFeed';
import { VendorHq } from '@/components/app/VendorHq';
import { BrandStudio } from '@/components/app/BrandStudio';
import { NotebookPen, Users } from 'lucide-react';
import { loadBrandScreen } from '@/lib/brandLoad';
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
  const params = await searchParams;
  const wanted = params.event;
  const openEventId = typeof wanted === 'string' ? wanted : null;

  /* And which celebration's workspace. This screen used to draw every
     workspace the reader could open, stacked, which put two of every anchor
     on the page: each one rendered `id="budget"` and each one's navigation
     linked to `#budget`, so every link in the second event opened the
     first event's panel. One at a time, named in the address. */
  const wantedWorkspace = typeof params.w === 'string' ? params.w : null;

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
  /* The wedding's brand and the data its pieces print, per workspace: the
     couple has one, and the studio needs the tables and the schedule. */
  const studios = new Map(
    await Promise.all(data.workspaces.map(async (w) => [w.id, await loadBrandScreen(sb, w, locale)] as const))
  );

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

  /* The one workspace this screen is about. Matched against the ones this
     reader may actually read, so an id naming somebody else's event resolves
     to their own first workspace rather than to anything of anybody else's. */
  const open = pickWorkspace(data.workspaces, wantedWorkspace);
  const shown = open ? [open] : [];

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
      <WorkspaceSwitcher
        workspaces={data.workspaces.map((w) => ({
          id: w.id, display_name: w.display_name, event_date: w.event_date,
        }))}
        selectedId={open?.id ?? null}
        label={ui.portal.eventPick}
        dateless={ui.portal.noDate}
      />

      <div className="space-y-6">
        {shown.map((w) => {
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
              {/* Handed in rather than printed here. These are sections of
                  the couple's event like every other one, and the order of
                  that screen is decided in one place — so the supplier desk
                  lands beside the suppliers instead of four panels below
                  them, and each one goes into the drawer it belongs in. */}
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
                slots={{
                  vendorhq: data.can(w.id, 'vendors') && data.vendorsFor(w.id).length > 0 ? (
                    <div id="vendorhq" data-jump={ui.portal.jumpVendorHq} data-jump-group="vendors" className="scroll-mt-28"><VendorHq
                      clientId={w.id} viewer="client"
                      vendors={data.vendorsFor(w.id)}
                      contracts={(contracts.get(w.id) ?? []).map((k) => ({ party_name: k.party_name ?? '', status: k.status, signed_at: k.signed_at }))}
                      lines={data.budgetFor(w.id).map((b) => ({ event_vendor_id: (b as { event_vendor_id?: string | null }).event_vendor_id ?? null, estimate: b.estimate, agreed: b.agreed }))}
                      couple={w.display_name} date={w.event_date} signAs={brand.name}
                    /></div>
                  ) : null,
                  studio: data.can(w.id, 'moodboard') && studios.get(w.id) ? (
                    <div id="studio" data-jump={ui.portal.jumpStudio} data-jump-group="day" className="scroll-mt-28"><BrandStudio
                      clientId={w.id} viewer="client"
                      brand={studios.get(w.id)!.brand} images={[]} data={studios.get(w.id)!.data}
                      canAi={false} printBase="" siteUrl={studios.get(w.id)!.siteUrl}
                    /></div>
                  ) : null,
                  contracts: data.can(w.id, 'contracts') ? (
                    <div id="contracts" data-jump={ui.portal.rowContracts} data-jump-group="vendors" className="scroll-mt-28"><Contracts clientId={w.id} contracts={contracts.get(w.id) ?? []} viewer="client" /></div>
                  ) : null,
                  /* Always, behind the share switch and nothing else.
                     It used to hide itself once a hall was typed on the event and
                     nothing had been added to compare, on the reasoning that a
                     comparison in front of a couple who booked a year ago is a
                     panel asking them to redo a decision. He overruled that, and
                     the reason he is right is the case the rule could not see: an
                     event carries a venue from the moment somebody types a
                     candidate into it, long before anything is signed, and from
                     that moment the couple lost the screen they tour halls with —
                     silently, with no row and no way back in. A drawer they can
                     open and find empty costs them one press; a drawer that is not
                     there costs them the feature. */
                  venues: data.can(w.id, 'venues') ? (
                    <div id="venues" data-jump={ui.portal.rowVenues} data-jump-group="vendors" className="scroll-mt-28"><VenueCompare
                      c={venuesFor(locale)}
                      clientId={w.id}
                      venues={venues.venues}
                      quoteUrls={venues.quoteUrls}
                      guestEstimate={w.guest_estimate ?? 0}
                    /></div>
                  ) : null,
                  /* Behind the same gate every other module is behind, so a plan
                     that does not include it does not quietly include it here. */
                  files: data.can(w.id, 'files') ? (
                    <div id="files" data-jump={ui.portal.rowFiles} data-jump-group="day" className="scroll-mt-28"><EventFiles clientId={w.id} files={files.get(w.id) ?? []} viewer="client" /></div>
                  ) : null,
                  /* Theirs to fill in. The equipment is read only for them — it is
                     the producer's logistics — and the component knows that. */
                  lists: data.can(w.id, 'lists') ? (
                    <div id="lists" data-jump={ui.portal.rowLists} data-jump-group="day" className="scroll-mt-28"><EventFileLists
                      clientId={w.id}
                      songs={eventFiles.get(w.id)?.songs ?? []}
                      kit={eventFiles.get(w.id)?.kit ?? []}
                      people={eventFiles.get(w.id)?.people ?? []}
                      viewer="client"
                    /></div>
                  ) : null,
                  /* The same panel the producer has on the event file, not a
                     read-only copy of it. Who the aunt is and what the dress
                     should look like are things only the couple knows, and a
                     screen where they can see the roster but not fix a name is a
                     screen that sends them back to WhatsApp — which is the
                     conversation this whole module exists to end. */
                  prep: data.can(w.id, 'prep') ? (
                    <div id="prep" data-jump={ui.portal.rowPrep} data-jump-group="day" className="scroll-mt-28"><PrepSheet
                      c={prepFor(locale)}
                      clientId={w.id}
                      vips={sheet.vips}
                      looks={sheet.looks}
                      shares={sheet.shares}
                      siteUrl={publicEnv.siteUrl}
                    /></div>
                  ) : null,
                  /* The two lists the event manager needs in hand on the night.
                     Written by either side, gated like everything else. */
                  envelopes: data.can(w.id, 'envelopes') ? (
                    <div id="envelopes" data-jump={ui.portal.rowEnvelopes} data-jump-group="day" className="scroll-mt-28"><EnvelopesPanel c={envelopesFor(locale)} clientId={w.id} items={envs} /></div>
                  ) : null,
                  transport: data.can(w.id, 'transport') ? (
                    <div id="transport" data-jump={ui.portal.rowTransport} data-jump-group="day" className="scroll-mt-28"><VehiclesPanel c={vehiclesFor(locale)} clientId={w.id} items={cars} /></div>
                  ) : null,
                  thread: data.can(w.id, 'messages') ? (
                    <div id="thread" data-jump={ui.portal.rowThread} data-jump-group="talk" className="scroll-mt-28"><Thread clientId={w.id} messages={threads.get(w.id) ?? []} viewerId={account.id} /></div>
                  ) : null,
                  /* Their deadlines and their day, in the calendar on their
                     phone, updating on its own. The link is a credential and
                     the card says so. */
                  calendar: (
                    <div id="calendar" data-jump={ui.portal.jumpCalendar} data-jump-group="day" className="scroll-mt-28"><CalendarFeed clientId={w.id} /></div>
                  ),
                }}
              />
            </div>
          );
        })}
      </div>

      {/* The two things wanted at a moment nobody plans for: reaching the
          producer, and saying something is wrong. Bound to the workspace on
          screen rather than to the first one in the list — with several open
          at once those were the same thing, and once they are not, a report
          filed from the henna belongs to the henna. */}
      {/* The two rooms that are not a section of one event: the journal of
          other people's weddings, and the circle of couples around this
          producer.

          Under the event rather than over it. They were the first thing on
          the screen, above the couple's own names and above the countdown,
          which put two optional reading rooms in front of the thing they
          opened the app for. They are worth having and they are not worth
          arriving to. */}
      <nav aria-label={ui.circle.title} className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link href="/app/portal/journal" className="card flex items-start gap-3 transition hover:border-accent/40">
          <NotebookPen size={20} aria-hidden strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <span className="block text-[15.5px] font-semibold text-ink">{ui.journal.title}</span>
            <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-soft">{ui.journal.sub}</span>
          </span>
        </Link>
        <Link href="/app/portal/community" className="card flex items-start gap-3 transition hover:border-accent/40">
          <Users size={20} aria-hidden strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <span className="block text-[15.5px] font-semibold text-ink">{ui.circle.title}</span>
            <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-soft">{ui.circle.sub}</span>
          </span>
        </Link>
      </nav>

      <PortalActions
        jump={<PortalJump c={{
          open: ui.portal.jumpOpen,
          title: ui.portal.jumpTitle,
          sub: ui.portal.jumpSub,
          close: ui.portal.jumpClose,
          /* The same five names the drawers carry, so the list somebody
             opens to find something is grouped exactly the way the screen
             they are looking at is. `event` stays as the fallback the
             component reaches for when a section names a group nobody
             defined. */
          groups: {
            me: ui.portal.jumpMine,
            money: ui.portal.jumpMoney,
            guests: ui.portal.jumpGuests,
            vendors: ui.portal.jumpVendors,
            day: ui.portal.jumpDay,
            talk: ui.portal.jumpTalk,
            event: ui.portal.jumpEvent,
          },
        }} />}
        producerName={brand.name}
        phone={brand.whatsapp}
        whatsapp={brand.whatsapp}
        bookingUrl={brand.bookingUrl}
        onReport={async (topic, body) => {
          'use server';
          return fileReport((open ?? data.workspaces[0]).id, topic, body);
        }}
      />
      {/* Every `#` link on this screen now points into a folded section.
          This is what keeps them working. */}
      <FoldReveal />
      <Live sources={PORTAL_LIVE_SOURCES} />
    </CopyProvider>
  );
}
