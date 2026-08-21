import Image from 'next/image';

/** Barak's own photograph, from the "האדם שהולך איתכם" section of the live
 *  site. It was a base64 blob in the single file HTML like everything else.
 *
 *  A page that asks a couple to hand over their wedding should show them the
 *  person they would be handing it to.
 *
 *  Two files, because one crop cannot do both jobs. The full frame is an
 *  environmental portrait — he is standing at a distance, off to one side —
 *  which reads well at card size and fails as a circle: a round crop of it
 *  landed on the screen behind him with his face small and near the edge.
 *  So `avatar` is a separate square cropped to head and shoulders. */

export function Portrait({
  className = '',
  sizes = '(max-width: 640px) 60vw, 320px',
  priority = false,
  avatar = false,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Square crop for small round frames. */
  avatar?: boolean;
}) {
  const src = avatar ? '/portrait-face.webp' : '/portrait-w480.webp';
  const w = avatar ? 256 : 480;
  const h = avatar ? 256 : 719;

  return (
    <Image
      src={src}
      alt="ברק ליור"
      width={w}
      height={h}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
