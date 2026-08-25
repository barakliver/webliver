import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The type scale this design system adds, named for tailwind-merge.
 *
 * Without this list, `cn('text-metric', 'text-ink')` returns `text-ink`. Not a
 * warning, not a wrong size: the size class is deleted. tailwind-merge groups
 * `text-*` by what it recognises, and a scale name it has never heard of gets
 * treated as a colour, so the colour that follows wins and the font-size
 * disappears somewhere between the source and the DOM.
 *
 * That is why the app looked like the palette without looking like the design.
 * `text-metric` and `text-metric-sm` — the 62px and 42px serif figures the
 * whole visual language is built on — were used zero times in the product,
 * because anyone who tried them saw no effect and reached for `text-[22px]`
 * instead. Every headline number in the app ended up a hardcoded pixel size
 * between 16 and 40. `text-display` and `text-title` were being dropped the
 * same way wherever they met a colour inside `cn`.
 *
 * Kept in step with tailwind.config.ts by src/lib/__tests__/utils.test.ts,
 * rather than by importing the config, which would pull it into the bundle.
 */
export const FONT_SIZES = ['display-xl', 'display', 'title', 'metric', 'metric-sm'] as const;

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
