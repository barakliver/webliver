'use client';

import { useEffect } from 'react';
import { DARK_CLASS } from '@/lib/theme';

/**
 * The evening's screen goes dark with the evening.
 *
 * The day-of screen is held in a hand in a hall after sunset, and a
 * cream page at full brightness in a dark room is a torch. From six in
 * the evening to six in the morning this puts the dark palette on for as
 * long as the screen is open, and takes it off again on leaving, so the
 * producer's own choice of theme is not rewritten: it is one class on
 * the root for one page, and `ThemeScope` puts the palette back in step
 * on the next navigation anyway. Somebody who chose dark already is left
 * alone.
 */
export function SunsetDark() {
  useEffect(() => {
    const h = new Date().getHours();
    const night = h >= 18 || h < 6;
    const root = document.documentElement;
    if (!night || root.classList.contains(DARK_CLASS)) return;
    root.classList.add(DARK_CLASS);
    root.style.colorScheme = 'dark';
    return () => { root.classList.remove(DARK_CLASS); root.style.colorScheme = 'light'; };
  }, []);
  return null;
}
