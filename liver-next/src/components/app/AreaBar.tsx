'use client';

import { usePathname } from 'next/navigation';
import { areaOf, type Area } from '@/lib/area';

/**
 * The short bar over a page title, in the colour of the area the screen is in.
 *
 * A client component for one reason: the title is drawn by a server component
 * that does not know the path it was asked for, and passing a colour down
 * through nineteen pages would be nineteen places to forget it. The bar
 * carries its own `data-area`, which is what `globals.css` reads to set the
 * colour it draws with, and it is decoration - nothing says it in words, so a
 * screen reader loses nothing.
 */
export function AreaBar({ area: given }: { area?: Area } = {}) {
  const path = usePathname();
  /* `area` is for the harness, which has no path of its own to be in. */
  const area = given ?? areaOf(path);
  return <span aria-hidden data-area={area} className="area-bar mb-3" />;
}
