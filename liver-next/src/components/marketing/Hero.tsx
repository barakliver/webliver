import Image from 'next/image';
import Link from 'next/link';
import type { SiteCopy } from '@/content/site';
import { publicEnv } from '@/lib/env';
import { Prose } from './Prose';
import { AmbientBackdrop } from './AmbientBackdrop';

/** The first screen of a wedding producer's site was a text card on a tinted
 *  gradient, with no photograph anywhere in it. The gradient stays as the
 *  ground; a real photograph now sits behind it, with a scrim heavy enough to
 *  keep the words readable across a frame that changes brightness from side to
 *  side. It is the same 3:2 file the gallery uses, so it costs one extra
 *  request and nothing new to generate.
 *
 *  This one is fetched at high priority: it is the largest thing above the
 *  fold, which makes it the LCP element. */
const HERO_STILL = '/portfolio/chuppah-105-w1400.webp';

export function Hero({ site }: { site: SiteCopy }) {
  return (
    <header className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src={HERO_STILL}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%]"
        />
        {/* Layered over the still rather than replacing it, so the page has a
            hero before any footage exists and still has one while it loads. */}
        {publicEnv.heroVideo && (
          <AmbientBackdrop src={publicEnv.heroVideo} poster={HERO_STILL} />
        )}
        {/* Weighted toward the side the words sit on rather than flat across
            the frame: enough contrast to read, while the photograph keeps its
            colour. A flat 70% wash turned a warm golden-hour frame grey. */}
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(9,13,20,.74)_0%,rgba(9,13,20,.55)_42%,rgba(9,13,20,.30)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent_0%,rgba(9,13,20,.55)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface-200" />
      </div>

      <div className="shell flex min-h-[86svh] flex-col justify-center py-24 sm:py-32">
        <p className="eyebrow animate-rise !text-white/80">{site.hero.eyebrow}</p>

        <h1 className="mt-4 max-w-[16ch] animate-rise font-display text-display-xl font-light text-white [animation-delay:60ms]">
          {site.hero.headline}
        </h1>

        <p className="mt-6 animate-rise font-display text-title font-light text-white/95 [animation-delay:120ms]">
          {site.hero.name}
        </p>

        <div className="mt-4 animate-rise [animation-delay:180ms]">
          {/* Prose sets text-ink-soft itself, which is a dark grey and would
              vanish against the photograph, so the override goes on Prose. */}
          <Prose lines={site.hero.body} className="!text-white/85" />
        </div>

        <div className="mt-9 animate-rise [animation-delay:240ms]">
          {/* btn-primary is ink on white ground. Over the photograph it was
              dark on dark, so the hero's call inverts to white on ink. */}
          <Link
            href="#contact"
            className="btn bg-white text-ink shadow-soft transition hover:bg-white/90"
          >
            {site.hero.cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
