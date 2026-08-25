import Link from 'next/link';
import { site } from '@/content/site';

export function Nav() {
  const links = [
    ['#philosophy', site.nav.philosophy],
    ['#journey', site.nav.journey],
    ['#about', site.nav.about],
    ['#budget', site.nav.budget],
  ] as const;

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-card/60 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-h-[44px] items-center font-display text-[17px] font-light tracking-tight text-ink">
          {site.brand}
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-none px-3.5 py-2 text-[14.5px] text-ink-soft transition hover:bg-card/70 hover:text-ink">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost !px-4 !py-2 !text-[14px]">{site.nav.login}</Link>
          <Link href="#contact" className="btn-primary !px-4 !py-2 !text-[14px]">{site.nav.contact}</Link>
        </div>
      </div>
    </nav>
  );
}
