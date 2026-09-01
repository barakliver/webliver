import Link from 'next/link';
import type { SiteCopy } from '@/content/site';

/**
 * The visitor's three moves, in the order they should make them.
 *
 * He asked for this in as many words: that the order of actions be
 * unmistakable. The page already told the production's story in six steps, but
 * a story is not an instruction, and a first time visitor still had to work
 * out for themselves what to actually do. This answers it the way a person
 * would: look first, count second, talk third.
 *
 * Three serif numerals in gold, because a number set at this size in the
 * display face is the most this design ever raises its voice, and the one
 * place it should is the one element whose whole job is to be followed. Each
 * step is one link and the whole row is the target; the third lands on the
 * meeting, which is where every path on this page is supposed to end.
 *
 * The anchors live here and not in the copy, because where a section sits on
 * the page is structure. The words can be rewritten from the site editor
 * without any risk of pointing step two at the wrong screen.
 */
const HREFS = ['#work', '#budget', '#contact'] as const;

export function BeginPath({ site }: { site: SiteCopy }) {
  return (
    <nav aria-label={site.begin.title} className="border-b border-line bg-surface-100">
      <div className="shell py-10 sm:py-14">
        <p className="eyebrow">{site.begin.title}</p>

        <ol className="mt-6 grid list-none gap-x-10 gap-y-2 p-0 sm:grid-cols-3">
          {site.begin.steps.map((step, i) => (
            <li key={step.title} className="border-t border-line sm:border-t-0">
              <Link
                href={HREFS[i]}
                className="group flex min-h-[44px] items-baseline gap-4 py-4 sm:block sm:border-t-2 sm:border-line sm:pt-5 sm:transition-colors sm:hover:border-accent-line"
              >
                {/* The numeral carries the order; the list carries the
                    semantics. aria-hidden so a screen reader, already inside
                    an ordered list, is not told "one one". */}
                <span
                  aria-hidden
                  className="font-display text-[40px] font-light leading-none text-accent-bright transition-colors group-hover:text-accent sm:text-[52px]"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 sm:mt-3 sm:block">
                  <span className="block font-display text-[20px] font-light leading-snug text-ink transition-colors group-hover:text-accent sm:text-[22px]">
                    {step.title}
                  </span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-soft">
                    {step.body}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
