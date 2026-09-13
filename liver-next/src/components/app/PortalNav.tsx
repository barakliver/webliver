import type { SummaryRow } from '@/components/app/PortalSummary';

/** The couple's way around their own screen: one pill per section, in the
 *  order the sections come, stuck under the header so it is there at the
 *  bottom of the page as much as at the top.
 *
 *  Built from the same rows as the summary strip, so a section the producer
 *  has closed is missing from both and a section added later appears in both
 *  without anyone remembering a second list. Plain anchors: the sections are
 *  on this page, and a link that scrolls is the whole of what is needed. */
export function PortalNav({ rows, label, sticky = true }: { rows: SummaryRow[]; label: string; sticky?: boolean }) {
  const live = rows.filter((r) => r.shown);
  if (live.length < 2) return null;
  return (
    <nav
      aria-label={label}
      /* The offset is the shell header's height. Not stuck on the producer's
         preview, which already has its own banner stuck to the top. */
      className={`${sticky ? 'sticky top-14 z-10 sm:top-16' : ''} -mx-4 mt-6 flex gap-1.5 overflow-x-auto border-b border-line bg-surface/95 px-4 py-2 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0`}
    >
      {live.map((r) => (
        <a
          key={r.key}
          href={r.href}
          /* 48px on a phone, which is the product's touch target and was not
             being met: these were 40px, and 34px from the small breakpoint up
             where they were being thumbed on a tablet just the same. A chip
             the width of a word is already a small target horizontally; there
             is no argument for making it small vertically as well. */
          className="inline-flex min-h-[48px] shrink-0 items-center whitespace-nowrap rounded-control border border-line bg-card px-4 text-[14px] text-ink-soft transition hover:border-accent/40 hover:text-accent"
        >
          {r.label}
        </a>
      ))}
    </nav>
  );
}
