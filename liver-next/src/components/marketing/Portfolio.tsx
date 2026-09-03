import Image from 'next/image';
import { portfolio, portfolioEn, SHOT_RATIO } from '@/content/portfolio';
import type { Locale } from '@/lib/locale';

/** Sits below the story rather than above it. On the live site the gallery
 *  was the second thing on the page and ran to 4,624px on a phone, 37% of the
 *  whole document, so a visitor met a wall of photographs before learning who
 *  Barak is or how he works. Photographs prove taste; they cannot prove
 *  method, so they come after the part that does. */
export function Portfolio({ locale }: { locale: Locale }) {
  const shots = locale === 'en' ? portfolioEn : portfolio;

  return (
    <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {shots.map((shot, i) => (
        <li key={shot.slug}>
          <figure className="group m-0 overflow-hidden rounded-xl2 bg-surface-200">
            <div className="relative overflow-hidden" style={{ aspectRatio: SHOT_RATIO }}>
              <Image
                src={`/portfolio/${shot.slug}-w1400.webp`}
                alt={shot.alt}
                fill
                /* One card wide on a phone, two on a tablet, three beyond, so
                   the browser picks the 700px file where that is all it needs. */
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                /* Only the first row is worth fetching before the scroll. */
                priority={i < 3}
                loading={i < 3 ? undefined : 'lazy'}
                className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
              />
            </div>
            {/* The caption in the display face, with a short gold rule where
                the reading begins. Eight photographs with sans captions read
                as a grid; the serif is what turns them back into a portfolio. */}
            <figcaption className="flex items-baseline gap-2.5 px-1 pb-1.5 pt-3.5">
              <span aria-hidden className="h-px w-4 shrink-0 self-center bg-accent-line/70" />
              <span className="font-display text-[16.5px] font-semibold text-ink">{shot.caption}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
