'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which of two layouts is actually on screen, so only that one is built.
 *
 * Several panels here draw their rows twice: a stack of cards for a phone and
 * a table for a desk, with CSS hiding one of them. That is the right design
 * and it is argued for where it is written — six columns is a desktop shape,
 * and a 680px table inside a horizontal scroller on a 390px screen asks a
 * thumb to drag sideways inside a page that also scrolls down. What it costs
 * is that both exist. `display: none` makes the hidden one free to lay out
 * and paint, and not free to build: at four hundred guests that is eight
 * hundred rows in the DOM and eight hundred components in React, half of
 * which nobody will ever see.
 *
 * So the breakpoint is readable from JavaScript and the panel builds one.
 *
 * The server does not know how wide the screen is, and guessing is how a
 * screen flashes the wrong layout or, worse, hydrates into a tree the server
 * did not send. So the server snapshot is `null`, which means "not known
 * yet": a panel reading it draws both, exactly what it draws today, and the
 * first client render matches the server's byte for byte. The real answer
 * arrives on the same tick as hydration and the half that is not on screen
 * goes away without anything moving, because it was already `display: none`.
 *
 * `useSyncExternalStore` rather than an effect, for that last part. An effect
 * runs after paint, so the browser would build both trees and then throw one
 * away; the store is read during render.
 */

/** Tailwind's `sm`. The one breakpoint these panels switch on. */
const WIDE = '(min-width: 640px)';

const subscribe = (fire: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', fire);
  return () => mq.removeEventListener('change', fire);
};

/** `true` on a desk, `false` on a phone, `null` before the browser has said.
 *  Treat `null` as "draw both": it is what the server sent. */
export function useWide(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}
