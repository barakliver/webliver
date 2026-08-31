import Link from 'next/link';
import { site as fallback, type SiteCopy } from '@/content/site';
import { LangToggle } from '@/components/marketing/LangToggle';
import { DEFAULT_LOCALE, type Locale } from '@/lib/locale';

/* The copy arrives from the page rather than being imported here, because the
   page is the thing that knows which language is being read and whether any of
   the wording has been edited. Importing it directly is how a nav ends up in
   Hebrew on an English page. */
export function Nav({ site = fallback, locale = DEFAULT_LOCALE }: {
  site?: SiteCopy; locale?: Locale;
} = {}) {
  const links = [
    ['#philosophy', site.nav.philosophy],
    ['#journey', site.nav.journey],
    ['#about', site.nav.about],
    ['#budget', site.nav.budget],
    /* A route rather than a hash: the shop is its own page, and a link that
       scrolls to nothing on every other page is worse than no link. */
    ['/store', site.nav.shop],
  ] as const;

  return (
    /* Opaque, not translucent. This bar is sticky over a full bleed photograph
       with white type on it, and at 60% the headline underneath came straight
       through: scrolling put "התכנון, התקציב, הספקים" across the brand mark.
       `glass` is the palette's own answer for chrome that floats over content,
       and it stopped being translucent when the palette changed; the nav was
       the one piece of chrome still setting its own background instead of
       asking for it. */
    <nav className="glass sticky top-0 z-30 border-b border-line">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-h-[44px] items-center font-display text-[17px] font-light tracking-tight text-ink">
          {site.brand}
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl2 px-3.5 py-2 text-[14.5px] text-ink-soft transition hover:bg-card/70 hover:text-ink">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LangToggle current={locale} className="hidden sm:inline-flex" />
          <Link href="/login" className="btn-ghost !px-4 !py-2 !text-[14px]">{site.nav.login}</Link>
          <Link href="#contact" className="btn-primary !px-4 !py-2 !text-[14px]">{site.nav.contact}</Link>
        </div>
      </div>
    </nav>
  );
}
