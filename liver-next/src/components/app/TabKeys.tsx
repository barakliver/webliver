'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Left and right walk the strip of sections.
 *
 * Fifteen tabs that scroll sideways are a long way to tab through one control
 * at a time, and the keyboard pattern for a row of tabs is arrows rather than
 * Tab — that is what a screen reader announces the row as, so it is what
 * somebody using one will try.
 *
 * The arrows are swapped under RTL, and that is not a nicety. In a Hebrew
 * page the next tab is to the LEFT: the row is laid out right to left, so
 * pressing right to go "forward" walks backwards through the list. MediaVault
 * already does this for its lightbox and this follows it rather than
 * inventing a second answer.
 *
 * Only while the focus is inside the strip. A global arrow listener steals
 * the arrows from every text field on the page, and this screen is mostly
 * forms.
 */
export function TabKeys({ hrefs, active }: { hrefs: string[]; active: number }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      /* Inside the strip, or this takes the arrows off every input. */
      const here = document.activeElement;
      if (!here || !here.closest('[data-tabstrip]')) return;

      const rtl = document.documentElement.dir === 'rtl';
      const onward = rtl ? 'ArrowLeft' : 'ArrowRight';

      let next = active;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = hrefs.length - 1;
      else next = active + (e.key === onward ? 1 : -1);

      if (next < 0 || next >= hrefs.length || next === active) return;
      e.preventDefault();
      router.push(hrefs[next], { scroll: false });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hrefs, active, router]);

  return null;
}
