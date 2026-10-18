'use client';

import { useEffect } from 'react';

/**
 * Says which of the install guides is the visitor's own, once the page is up.
 *
 * The page gives three lists and deliberately does not choose between them on
 * the server: a phone opening it from inside another app reports a browser that
 * cannot install anything, and a wrong guess presented as the answer is worse
 * than three lists. So the choice is only ever an addition. After mount, the
 * list that matches what the device says about itself is marked and moved to
 * the top; the other two stay exactly where they were, one scroll away. If the
 * device says nothing useful, nothing happens.
 *
 * It marks elements it does not own, by a data attribute, so the page that
 * draws them stays a server component.
 */
export function YourDevice({ label }: { label: string }) {
  useEffect(() => {
    const ua = navigator.userAgent;
    const ipad = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const device = ipad ? 'ios' : /Android/.test(ua) ? 'android' : /Windows|Macintosh|Linux|CrOS/.test(ua) ? 'desktop' : null;
    if (!device) return undefined;
    const mine = document.querySelector<HTMLElement>(`[data-device="${device}"]`);
    if (!mine) return undefined;
    mine.dataset.you = label;
    mine.style.order = '-1';
    return () => { delete mine.dataset.you; mine.style.order = ''; };
  }, [label]);
  return null;
}
