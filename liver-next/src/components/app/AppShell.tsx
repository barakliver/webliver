import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { appCopy } from '@/content/site';
import { brandStyle, type Brand } from '@/lib/branding';
import type { Account } from '@/lib/auth';
import { NoticeBell, type Notice } from './NoticeBell';
import { DesktopNav, MobileTabBar, type NavItem } from './AppNav';
import { Avatar } from './Avatar';

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
    <div className="min-h-dvh bg-surface" style={brandStyle(brand)}>
      {/* Glass belongs on chrome. The header floats over content and the blur
          is what tells you so; the cards underneath stay opaque.

          The top inset is the whole reason this looks wrong installed. The
          viewport is set to `cover` so the page can reach the edges, and in a
          browser Safari's own chrome happens to sit between the page and the
          clock. Installed there is no chrome, the page starts at y=0, and the
          brand name renders underneath the status bar and behind the notch.
          Reserving the inset here fixes it everywhere at once, and costs
          nothing on a device that reports zero. */}
      <header
        className="glass sticky top-0 z-40 border-b border-line"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="shell flex h-14 items-center justify-between gap-4 sm:h-16">
          {/* A producer's own mark, or their name. Never both theirs and the
              platform's: a white-labelled workspace that also carries the
              platform's name is not white-labelled, it is co-branded, which is
              the opposite of what was asked for. */}
          <Link
            href="/app"
            className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-70"
          >
            {brand.logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-7 w-auto max-w-[140px] object-contain sm:h-8"
                />
                <span className="sr-only">{brand.name}</span>
              </>
            ) : (
              <span className="truncate font-display text-[17px] font-light text-ink">
                {brand.name}
              </span>
            )}
          </Link>

          <DesktopNav items={items} />

          <div className="flex items-center gap-2">
            <NoticeBell notices={notices} />
            <Link
              href="/app/me"
              className="rounded-none transition-opacity hover:opacity-80"
              aria-label={appCopy.profile.title}
            >
              <Avatar name={account.fullName || account.email} src={account.avatarUrl} size={34} />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label={appCopy.signOut}
                title={appCopy.signOut}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-2
                           rounded-none px-3 text-[14px] text-ink-soft transition
                           hover:bg-surface-200 hover:text-ink"
              >
                <LogOut size={16} strokeWidth={1.5} aria-hidden />
                <span className="hidden sm:inline">{appCopy.signOut}</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pb leaves room for the bottom bar plus the home indicator, and stops
          doing so at the width where the bottom bar goes away. */}
      <main id="main" className="shell py-8 pb-32 sm:py-12 lg:pb-14">{children}</main>

      <MobileTabBar items={items} />
    </div>
  );
}
