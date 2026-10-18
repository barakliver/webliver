'use client';

import { useEffect, useRef, useState } from 'react';
import { fill } from '@/lib/copyText';

/**
 * The line across the top of a long document, and how long the document is.
 *
 * The privacy policy and the terms are read once, by somebody who is deciding
 * whether to go on, and the question under that is "how much more is there".
 * A line that fills as the page goes past answers it without a word, and the
 * minutes say it before anybody starts.
 *
 * The count is read from the page after it has hydrated, never during it, so
 * a server render and the client draw the same nothing; and it is words over
 * two hundred a minute, rounded up, which is a promise nobody can catch out.
 * The bar is decoration: it carries nothing a screen reader would need.
 */
export function ReadingProgress({ minutes }: { /** "About {n} min read", resolved by the caller. */ minutes: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    const main = document.getElementById('main');
    if (main) {
      const words = (main.innerText.match(/\S+/g) ?? []).length;
      setN(Math.max(1, Math.ceil(words / 200)));
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const seen = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${seen})`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <span aria-hidden className="fixed inset-x-0 top-0 z-40 block h-[3px] bg-transparent">
        <span ref={bar} className="block h-full origin-[100%_50%] bg-tone-rubine will-change-transform ltr:origin-[0_50%]" style={{ transform: 'scaleX(0)' }} />
      </span>
      {n !== null && (
        <p className="animate-rise mt-3 inline-flex items-center gap-2 rounded-full bg-surface-200 px-3 py-1 text-meta text-ink-soft">
          <span aria-hidden className="size-1.5 rounded-full bg-tone-rubine" />
          {fill(minutes, { n })}
        </p>
      )}
    </>
  );
}
