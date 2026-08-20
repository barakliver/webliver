import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { site, appCopy } from '@/content/site';
import type { Account } from '@/lib/auth';
import { NoticeBell, type Notice } from './NoticeBell';

type Item = { href: string; label: string };

function navFor(a: Account): Item[] {
  if (a.role === 'client') return [{ href: '/app/portal', label: appCopy.nav.portal }];
  const items: Item[] = [
    { href: '/app', label: appCopy.nav.overview },
    { href: '/app/leads', label: appCopy.nav.leads },
    { href: '/app/clients', label: appCopy.nav.clients },
  ];
  if (a.role === 'super_admin') items.push({ href: '/app/admin', label: appCopy.nav.admin });
  return items;
}

export function AppShell({ account, notices, children }: { account: Account; notices: Notice[]; children: React.ReactNode }) {
  const items = navFor(account);

  return (
    <div className="min-h-dvh bg-haze-50">
      <header className="sticky top-0 z-40 border-b border-line glass">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link href="/" className="font-display text-[17px] font-semibold text-ink">
            {account.producer?.brandName || site.brand}
          </Link>

          <nav aria-label="ניווט ראשי" className="hidden gap-1 sm:flex">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="btn-quiet px-3 py-2 text-[14.5px]">
                {i.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NoticeBell notices={notices} />
            <form action={signOut}>
              <button type="submit" className="btn-ghost px-4 py-2 text-[14px]">{appCopy.signOut}</button>
            </form>
          </div>
        </div>

        <nav aria-label="ניווט ראשי" className="shell flex gap-1 overflow-x-auto pb-2 sm:hidden">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="btn-quiet whitespace-nowrap px-3 py-1.5 text-[14px]">
              {i.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="shell py-10 sm:py-14">{children}</main>
    </div>
  );
}
