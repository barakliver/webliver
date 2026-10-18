import type { CSSProperties } from 'react';
import { TONE, toneAt } from '@/lib/tone';

/* Fixed rather than random: a server render and the client must agree, and a
   burst that is the same every time is still read as a burst. Angle, reach and
   delay are spread by hand so no two neighbours leave together. */
const PETALS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.17;
  const reach = 90 + ((i * 37) % 70);
  return {
    x: `${Math.round(Math.cos(a) * reach)}px`,
    y: `${Math.round(Math.sin(a) * reach * 0.6 + 120 + (i % 4) * 22)}px`,
    r: `${(i % 2 ? 1 : -1) * (160 + ((i * 53) % 200))}deg`,
    d: `${(i % 6) * 0.07}s`,
  };
});

/** A small burst of the palette's colours, for an answer that is a yes. It
 *  fills its nearest positioned parent and takes no pointer. */
export function Petals() {
  return (
    <span aria-hidden className="petals">
      {PETALS.map((p, i) => (
        <span key={i} className={`petal ${TONE[toneAt(i)].dot}`}
          style={{ '--x': p.x, '--y': p.y, '--r': p.r, '--d': p.d } as CSSProperties} />
      ))}
    </span>
  );
}
