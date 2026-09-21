import Link from 'next/link';
import type { SiteCopy } from '@/content/site';

/**
 * The journey, as hairline rows rather than as tiles.
 *
 * It was a three-column grid of glass cards, which is the shape every agency
 * site uses for a process and the shape this palette does not have. The Lux
 * direction reads them as a document instead: a serif numeral in gold, a rule
 * under each row, and nothing else. Nothing to click, nothing raised, no fill.
 *
 * Roman numerals because the number is a position and not a quantity. A row
 * marked `3` invites the question "three what"; `III` does not, and it is the
 * one place on this page where a decorative serif is carrying meaning rather
 * than decoration.
 */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function Steps({ site }: { site: SiteCopy }) {
  return (
    <section id="journey" className="section shell">
      <h2 className="font-display text-display font-bold text-editorial">{site.journey.title}</h2>

      <ol className="mt-10 list-none p-0">
        {site.journey.steps.map((step, i) => (
          <li
            key={step}
            className="flex items-baseline gap-5 border-t border-line py-5 sm:gap-8 sm:py-6"
          >
            <span
              aria-hidden
              /* The words accent rather than the bright one. `accent-bright` is
                 measured for large numerals and clears 3:1, which is the bar
                 for text at 24px or at 18.66px bold; a roman numeral set at 19
                 in semibold is neither, so it needed 4.5 and had 3.5. Caught
                 by the accessibility audit, which is not part of `npm run
                 check` because it needs a server, which is most of why it sat
                 here. */
              className="w-8 shrink-0 font-display text-[19px] font-semibold tracking-[.06em] text-accent sm:w-12 sm:text-[22px]"
            >
              {ROMAN[i] ?? i + 1}
            </span>
            <span className="text-[16.5px] leading-relaxed text-ink sm:text-[18px]">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 border-t border-line pt-8">
        <Link href="#contact" className="btn-ghost">{site.journey.link}</Link>
      </div>
    </section>
  );
}
