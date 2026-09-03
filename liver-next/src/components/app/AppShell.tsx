import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { appCopy } from '@/content/site';
import { brandStyle, type Brand } from '@/lib/branding';
import { isLive, type Account } from '@/lib/auth';
import { NoticeBell, type Notice } from './NoticeBell';
import { SidebarNav, MobileTabBar, type NavItem } from './AppNav';
import { Avatar } from './Avatar';
import { IssueReporter } from './IssueReporter';
import { ProducerCopilot } from './ProducerCopilot';
import { cn } from '@/lib/utils';

/** The couple's two labels in the couple's language. The producer's console
 *  stays Hebrew, so only these two travel as a prop. */
export type ClientNavLabels = { portal: string; guide: string };

function navFor(a: Account, clientNav?: ClientNavLabels): NavItem[] {
  if (a.role === 'client') {
    /* Two destinations, which is what makes the phone's bottom bar appear for
       a couple: their event, and the book that explains it. */
    return [
      { href: '/app/portal', label: clientNav?.portal ?? appCopy.nav.portal, icon: 'portal' },
      { href: '/app/guide', label: clientNav?.guide ?? appCopy.nav.guide, icon: 'guide' },
    ];
  }
  const items: NavItem[] = [
    { href: '/app',         label: appCopy.nav.overview, icon: 'overview' },
    { href: '/app/leads',   label: appCopy.nav.leads,    icon: 'leads' },
    { href: '/app/clients', label: appCopy.nav.clients,  icon: 'clients' },
    { href: '/app/calendar', label: appCopy.nav.calendar, icon: 'calendar' },
    { href: '/app/insights', label: appCopy.nav.insights, icon: 'insights' },
    { href: '/app/vendors', label: appCopy.nav.vendors,  icon: 'vendors' },
    { href: '/app/store',   label: appCopy.nav.store,    icon: 'store' },
    { href: '/app/sop',     label: appCopy.nav.sop,      icon: 'sop' },
    { href: '/app/guide',   label: appCopy.nav.guide,    icon: 'guide' },
    { href: '/app/brand',   label: appCopy.nav.brand,    icon: 'brand' },
  ];
  if (a.role === 'super_admin') {
    /* The public site is one site and it belongs to the account the enquiry
       form files leads under. Offering the editor to every producer would be
       offering most of them a screen that edits somebody else's homepage. */
    items.push({ href: '/app/site', label: appCopy.nav.site, icon: 'site' });
    items.push({ href: '/app/admin', label: appCopy.nav.admin, icon: 'admin' });
  }
  return items;
}

/** A producer's own mark, or their name. Never both theirs and the
 *  platform's: a white-labelled workspace that also carries the platform's
 *  name is not white-labelled, it is co-branded, which is the opposite of
 *  what was asked for. */
function Brand({ brand }: { brand: Brand }) {
  return (
    <Link href="/app" className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-70">
      {brand.logoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt={brand.name} className="h-7 w-auto max-w-[140px] object-contain sm:h-8" />
          <span className="sr-only">{brand.name}</span>
        </>
      ) : (
        <span className="truncate font-display text-[18px] font-light text-ink">{brand.name}</span>
      )}
    </Link>
  );
}

export function AppShell({
  account, notices, brand, clientNav, children,
}: {
  account: Account; notices: Notice[]; brand: Brand;
  clientNav?: ClientNavLabels; children: React.ReactNode;
}) {
  const items = navFor(account, clientNav);
  /* A producer still waiting for approval has no events to ask about and
     the route would refuse them anyway; no button is better than a button
     that answers with an apology. */
  const isProducer = account.role !== 'client' && isLive(account);

  return (
    /* The accent is repainted here rather than in a stylesheet: one style
       attribute on the outermost element, so it cannot arrive after the first
       paint and costs no extra request. Everything inside reads the accent
       through these properties, which is why the tokens are variables. */
    /* The producer's ground is a shade brighter than the couple's. It is a
       working screen rather than a keepsake, and the extra light is what keeps
       a table of forty rows from reading as heavy. */
    <div
      className={cn('brand-scope min-h-dvh', account.role === 'client' ? 'bg-surface' : 'bg-surface-100')}
      style={brandStyle(brand)}
    >
      <div className="lg:flex">
        {/* ── the rail ───────────────────────────────────────────────────
            A hairline is the whole separation. It does not scroll with the
            content, so a screen of forty rows never puts the navigation out
            of reach, which is most of what made the long screens tiring. */}
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 flex-col overflow-y-auto border-s border-line px-7 py-8 lg:flex">
          <div className="min-w-0">
            <Brand brand={brand} />

            {/* The account, directly under the mark. It sat at the foot of
                the rail, pinned to the bottom of the viewport, which on a
                laptop put the name and the way out behind the floating
                accessibility button and the last few pixels of the window.
                Up here it is always in view, and the rail scrolls rather
                than clips when a screen is short. The bell moved to the top
                bar, where every app keeps one. */}
            <div className="mt-5 flex min-w-0 items-center gap-2">
              <Link
                href="/app/me"
                className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-75"
              >
                <Avatar name={account.fullName || account.email} src={account.avatarUrl} size={30} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-soft">
                  {account.fullName || account.email}
                </span>
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label={appCopy.signOut}
                  title={appCopy.signOut}
                  className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition-colors hover:bg-surface-200 hover:text-ink"
                >
                  <LogOut size={15} strokeWidth={1.5} aria-hidden />
                </button>
              </form>
            </div>

            <hr className="rule-gold mt-5" />
            <div className="mt-6">
              <SidebarNav items={items} />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── the phone's header ──────────────────────────────────────
              Below the rail's width the navigation is the bottom bar, so
              this carries only the mark and the controls that have nowhere
              else to be.

              The top inset is the whole reason this looks wrong installed.
              The viewport is set to `cover` so the page can reach the edges,
              and in a browser Safari's own chrome happens to sit between the
              page and the clock. Installed there is no chrome, the page
              starts at y=0, and the brand name renders underneath the status
              bar. Reserving the inset costs nothing where it reports zero. */}
          <header
            className="glass sticky top-0 z-40 border-b border-line lg:hidden"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="shell flex h-14 items-center justify-between gap-4 sm:h-16">
              <Brand brand={brand} />
              <div className="flex items-center gap-1">
                <IssueReporter userId={account.id} compact />
                <NoticeBell notices={notices} />
                <Link
                  href="/app/me"
                  className="ms-1 transition-opacity hover:opacity-80"
                  aria-label={appCopy.profile.title}
                >
                  <Avatar name={account.fullName || account.email} src={account.avatarUrl} size={32} />
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    aria-label={appCopy.signOut}
                    title={appCopy.signOut}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center
                               text-ink-soft transition-colors hover:text-ink"
                  >
                    <LogOut size={16} strokeWidth={1.5} aria-hidden />
                  </button>
                </form>
              </div>
            </div>
          </header>

          {/* ── the desk's top bar ──────────────────────────────────────
              A thin strip over the content with the two things wanted from
              any screen: what happened, and a way to say something is wrong.
              At the end edge, where every app keeps them, and glass so the
              page shows through as it scrolls under. */}
          <header className="glass sticky top-0 z-40 hidden border-b border-line lg:block">
            <div className="mx-auto flex h-14 w-full max-w-content items-center justify-end gap-1 px-8">
              <IssueReporter userId={account.id} />
              <NoticeBell notices={notices} />
            </div>
          </header>

          {/* pb leaves room for the bottom bar plus the home indicator, and
              stops doing so at the width where the bottom bar goes away. */}
          <main
            id="main"
            className="mx-auto w-full max-w-content px-4 py-7 pb-32 sm:px-8 sm:py-9 lg:pb-16"
          >
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar items={items} />

      {/* The producer's own assistant. Not for a couple: their concierge is
          the producer, and a second voice in their area would be the
          platform speaking, which it must not. */}
      {isProducer && <ProducerCopilot brandName={brand.name} />}
    </div>
  );
}
