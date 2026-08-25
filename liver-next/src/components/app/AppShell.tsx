import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { appCopy } from '@/content/site';
import { brandStyle, type Brand } from '@/lib/branding';
import type { Account } from '@/lib/auth';
import { NoticeBell, type Notice } from './NoticeBell';
import { SidebarNav, MobileTabBar, type NavItem } from './AppNav';
import { Avatar } from './Avatar';
import { cn } from '@/lib/utils';

function navFor(a: Account): NavItem[] {
  if (a.role === 'client') {
    return [{ href: '/app/portal', label: appCopy.nav.portal, icon: 'portal' }];
  }
  const items: NavItem[] = [
    { href: '/app',         label: appCopy.nav.overview, icon: 'overview' },
    { href: '/app/leads',   label: appCopy.nav.leads,    icon: 'leads' },
    { href: '/app/clients', label: appCopy.nav.clients,  icon: 'clients' },
    { href: '/app/calendar', label: appCopy.nav.calendar, icon: 'calendar' },
    { href: '/app/insights', label: appCopy.nav.insights, icon: 'insights' },
    { href: '/app/vendors', label: appCopy.nav.vendors,  icon: 'vendors' },
    { href: '/app/sop',     label: appCopy.nav.sop,      icon: 'sop' },
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
  account, notices, brand, children,
}: {
  account: Account; notices: Notice[]; brand: Brand; children: React.ReactNode;
}) {
  const items = navFor(account);

  return (
    /* The accent is repainted here rather than in a stylesheet: one style
       attribute on the outermost element, so it cannot arrive after the first
       paint and costs no extra request. Everything inside reads the accent
       through these properties, which is why the tokens are variables. */
    /* The producer's ground is a shade brighter than the couple's. It is a
       working screen rather than a keepsake, and the extra light is what keeps
       a table of forty rows from reading as heavy. */
    <div
      className={cn('min-h-dvh', account.role === 'client' ? 'bg-surface' : 'bg-surface-100')}
      style={brandStyle(brand)}
    >
      <div className="lg:flex">
        {/* ── the rail ───────────────────────────────────────────────────
            A hairline is the whole separation. It does not scroll with the
            content, so a screen of forty rows never puts the navigation out
            of reach, which is most of what made the long screens tiring. */}
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 flex-col justify-between border-s border-line px-7 pb-24 pt-8 lg:flex">
          <div className="min-w-0">
            <Brand brand={brand} />
            <hr className="rule-gold mt-6" />
            <div className="mt-6">
              <SidebarNav items={items} />
            </div>
          </div>

          {/* The account, at the foot of the rail rather than in a corner of
              a header, because that is where it stops competing with the
              screen's own title. */}
          <div className="min-w-0 border-t border-line pt-5">
            <Link
              href="/app/me"
              className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-75"
            >
              <Avatar name={account.fullName || account.email} src={account.avatarUrl} size={32} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-soft">
                {account.fullName || account.email}
              </span>
            </Link>
            <div className="mt-3 flex items-center justify-between gap-2">
              <NoticeBell notices={notices} />
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex min-h-[36px] items-center gap-2 px-2 text-[13.5px]
                             text-ink-mute transition-colors hover:text-ink"
                >
                  <LogOut size={15} strokeWidth={1.5} aria-hidden />
                  {appCopy.signOut}
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── the phone's header ──────────────────────────────────────
              Below the rail's width the navigation is the bottom bar, so
              this carries only the mark and the two controls that have
              nowhere else to be.

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
              <div className="flex items-center gap-2">
                <NoticeBell notices={notices} />
                <Link
                  href="/app/me"
                  className="transition-opacity hover:opacity-80"
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
    </div>
  );
}
