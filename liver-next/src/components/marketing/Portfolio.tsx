import Image from 'next/image';
import { portfolio, SHOT_RATIO } from '@/content/portfolio';

/** Sits below the story rather than above it. On the live site the gallery
 *  was the second thing on the page and ran to 4,624px on a phone, 37% of the
 *  whole document, so a visitor met a wall of photographs before learning who
 *  Barak is or how he works. Photographs prove taste; they cannot prove
 *  method, so they come after the part that does. */
export function Portfolio() {
  return (
    <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {portfolio.map((shot, i) => (
        <li key={shot.slug}>
          <figure className="group m-0 overflow-hidden rounded-2xl bg-ivory-200">
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
            <figcaption className="px-1 pb-1 pt-3 text-[14.5px] text-ink-soft">
              {shot.caption}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
