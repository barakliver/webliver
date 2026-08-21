import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { site, appCopy } from '@/content/site';
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
  ];
  if (a.role === 'super_admin') {
    items.push({ href: '/app/admin', label: appCopy.nav.admin, icon: 'admin' });
  }
  return items;
}

export function AppShell({
  account, notices, children,
}: {
  account: Account; notices: Notice[]; children: React.ReactNode;
}) {
  const items = navFor(account);

  return (
    <div className="min-h-dvh bg-ivory">
      {/* Glass belongs on chrome. The header floats over content and the blur
          is what tells you so; the cards underneath stay opaque. */}
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-[17px] font-semibold text-ink transition-opacity hover:opacity-70"
          >
            {account.producer?.brandName || site.brand}
          </Link>

          <DesktopNav items={items} />

          <div className="flex items-center gap-2">
            <NoticeBell notices={notices} />
            <Link
              href="/app/me"
              className="rounded-full transition-opacity hover:opacity-80"
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
                           rounded-full px-3 text-[14px] text-ink-soft transition
                           hover:bg-ivory-200 hover:text-ink"
              >
                <LogOut size={16} strokeWidth={1.9} aria-hidden />
                <span className="hidden sm:inline">{appCopy.signOut}</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pb leaves room for the bottom bar plus the home indicator. */}
      <main id="main" className="shell py-8 pb-32 sm:py-12 sm:pb-14">{children}</main>

      <MobileTabBar items={items} />
    </div>
  );
}
