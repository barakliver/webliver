import Link from 'next/link';
import { site } from '@/content/site';
import { Prose } from './Prose';

/** The panorama is a CSS-composed ambient field rather than a photograph, so
 *  the entrance stays instant on mobile and needs no image budget. A real
 *  360 still can be dropped into .hero-pano later without touching layout. */
export function Hero() {
  return (
    <header className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-pano absolute inset-0 animate-drift bg-[radial-gradient(1100px_560px_at_20%_18%,#dbeafe_0%,transparent_60%),radial-gradient(900px_520px_at_82%_12%,#e8f0fb_0%,transparent_62%),radial-gradient(760px_460px_at_50%_92%,#eaf3ff_0%,transparent_66%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-haze-50" />
      </div>

      <div className="shell flex min-h-[86svh] flex-col justify-center py-24 sm:py-32">
        <p className="eyebrow animate-rise">{site.hero.eyebrow}</p>

        <h1 className="mt-4 max-w-[16ch] animate-rise font-display text-display-xl font-semibold text-ink [animation-delay:60ms]">
          {site.hero.headline}
        </h1>

        <p className="mt-6 animate-rise font-display text-title font-semibold text-ink [animation-delay:120ms]">
          {site.hero.name}
        </p>

        <div className="mt-4 animate-rise [animation-delay:180ms]">
          <Prose lines={site.hero.body} />
        </div>

        <div className="mt-9 animate-rise [animation-delay:240ms]">
          <Link href="#contact" className="btn-primary">{site.hero.cta}</Link>
        </div>
      </div>
    </header>
  );
}
