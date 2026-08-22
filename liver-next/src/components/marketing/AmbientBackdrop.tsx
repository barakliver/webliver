'use client';

import { useEffect, useState } from 'react';

/**
 * A moving backdrop, when there is one to move.
 *
 * The photograph is always rendered, by the server, and stays the poster and
 * the largest thing above the fold. The video layers over it once footage
 * exists, which means three things this page needs: the hero never depends on
 * a file that has not been shot yet, the LCP element does not change when it
 * is, and somebody on a train sees a wedding rather than a grey rectangle
 * while eleven megabytes arrive.
 *
 * It does not mount at all for a visitor who has asked for less motion. Hiding
 * it in CSS would have downloaded the file anyway, and "reduce motion" is
 * asked for by people for whom a panning background is not a preference.
 */
export function AmbientBackdrop({ src, poster }: { src: string; poster: string }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setPlay(!query.matches);
    decide();
    query.addEventListener('change', decide);
    return () => query.removeEventListener('change', decide);
  }, []);

  if (!play) return null;

  return (
    <video
      /* playsInline or iOS takes the video fullscreen the moment it starts,
         which on a background is the page disappearing. */
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden
      tabIndex={-1}
      className="absolute inset-0 h-full w-full object-cover object-[center_28%] motion-safe:animate-[fadeIn_1.2s_ease-out]"
    >
      <source src={src} />
    </video>
  );
}
