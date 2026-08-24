import { cn } from '@/lib/utils';

/** The first letter of each of the first two words, which for both Hebrew and
 *  Latin names gives the initials people expect. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return '?';
  return parts.map((p) => Array.from(p)[0]).join('');
}

/** A name always produces the same tint, so a face you know keeps the same
 *  colour every time you see it and the grid stays recognisable at a glance. */
const TINTS = [
  'bg-accent-wash text-accent',
  'bg-ok-wash text-ok',
  'bg-warn-wash text-warn',
  'bg-surface-200 text-ink-soft',
] as const;

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({
  name, src, size = 36, className,
}: {
  name: string; src?: string | null; size?: number; className?: string;
}) {
  const label = name || '';
  const dim = { width: size, height: size };

  if (src) {
    return (
      /* A plain img, not next/image: the source is a Supabase URL that changes
         whenever the person replaces their picture, and the loader would need
         every such host allow-listed for no benefit at this size. */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        style={dim}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-line', className)}
      />
    );
  }

  return (
    <span
      style={{ ...dim, fontSize: Math.round(size * 0.38) }}
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-medium ring-1 ring-line',
        tintFor(label), className,
      )}
    >
      {initials(label)}
    </span>
  );
}
