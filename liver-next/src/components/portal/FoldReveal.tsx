'use client';

import { useEffect } from 'react';
import { reveal } from '@/lib/reveal';

/**
 * Makes every `#` link on the couple's screen keep working now the sections
 * are folded.
 *
 * "מה עכשיו" ends in a button to the panel where that thing is done, and that
 * button is an ordinary link to a fragment. With the sections in drawers its
 * target is inside a closed one, and a browser that will not open a drawer by
 * itself scrolls nowhere at all: the button looks dead, on the one card the
 * whole screen is built around.
 *
 * Three ways in, all of them handled here rather than at each link: a click
 * on the page, a hash that changes under the router, and an address that
 * arrived with one already on it. The click is caught on the way down and
 * nothing is cancelled — the drawer is open before the browser looks for the
 * target, so the browser's own scroll lands correctly and keyboard focus
 * behaves the way it does on every other anchor.
 */
export function FoldReveal() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('#')) return;
      reveal(href);
    };
    const onHash = () => {
      const el = reveal(window.location.hash);
      /* The browser has already decided it cannot scroll to something it
         could not see, so finish the job it gave up on. */
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', onHash);
    /* An address pasted with a fragment on it: the first paint has happened
       and the browser has already tried and failed. */
    if (window.location.hash) onHash();

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  return null;
}
