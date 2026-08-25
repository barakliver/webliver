'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The hero's depth, driven by the cursor.
 *
 * The image layer moves against the pointer and the text layer moves with it,
 * by different amounts. That difference is the whole effect: two planes at
 * different distances, which is what a single moving layer never reads as.
 *
 * Deliberately not a scroll effect. Scroll parallax fights the reader on a
 * phone, where the finger doing the scrolling is also the thing being tracked;
 * a pointer has no such conflict, and a device without one gets a still hero,
 * which is a perfectly good hero.
 *
 * Three things keep it from being a nuisance. It runs only on a device that
 * actually has a fine pointer. It stops entirely when the reader has asked for
 * reduced motion, and it keeps listening, so turning that on mid-session takes
 * effect without a reload. And the transform is applied on a ref rather than
 * through state, so moving a mouse across a hero does not re-render a tree
 * sixty times a second.
 */
export function Parallax({
  image, text, children,
}: {
  image?: number; text?: number; children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setLive(fine.matches && !still.matches);
    decide();
    fine.addEventListener('change', decide);
    still.addEventListener('change', decide);
    return () => {
      fine.removeEventListener('change', decide);
      still.removeEventListener('change', decide);
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const layers = () => el.querySelectorAll<HTMLElement>('[data-parallax]');

    if (!live) {
      /* Put everything back. A transform left applied when the preference
         changes would freeze the hero mid-lean. */
      layers().forEach((l) => { l.style.transform = ''; });
      return;
    }

    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        /* -0.5 to 0.5 of the element, not of the window: the hero leans
           toward the cursor over itself, which is what makes it feel like an
           object rather than like the page tilting. */
        const x = (e.clientX - box.left) / box.width - 0.5;
        const y = (e.clientY - box.top) / box.height - 0.5;
        layers().forEach((l) => {
          const depth = Number(l.dataset.parallax) || 0;
          l.style.transform = `translate3d(${x * depth}px, ${y * depth * 0.7}px, 0)`;
        });
      });
    };

    const rest = () => {
      cancelAnimationFrame(frame);
      layers().forEach((l) => { l.style.transform = 'translate3d(0,0,0)'; });
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', rest);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', rest);
    };
  }, [live]);

  return (
    <div ref={host} style={{ perspective: '1400px' }} className="relative h-full w-full">
      {children}
    </div>
  );
}

/** One plane. `depth` is how far it travels at the edge of the box, in pixels;
 *  negative moves against the cursor, which is what the layer behind does. */
export function Layer({
  depth, className, children,
}: {
  depth: number; className?: string; children: React.ReactNode;
}) {
  return (
    <div
      data-parallax={depth}
      className={`parallax-layer transition-transform duration-slow ease-out ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
