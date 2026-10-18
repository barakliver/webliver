import { cn } from '@/lib/utils';

/**
 * The strip over a document: a few swatches of the card's colours with one
 * figure each, on screen only.
 *
 * The documents themselves - the run sheet, the numbers sheet, the book - are
 * paper, and paper stays white, so none of this is in what is printed. It is
 * the screen around the paper, and it says what the paper cannot: which version
 * this is, how many people are coming, what in the book is still empty.
 *
 * Tones are written out in full because Tailwind reads class names as text;
 * the second class is the on-colour at 90%, which is what clears 4.5 on the boho.
 */
const TONES = {
  camel:    { box: 'bg-tone-camel text-tone-camel-on',       soft: 'text-tone-camel-on/90' },
  boho:     { box: 'bg-tone-boho text-tone-boho-on',         soft: 'text-tone-boho-on/90' },
  rubine:   { box: 'bg-tone-rubine text-tone-rubine-on',     soft: 'text-tone-rubine-on/90' },
  tamarind: { box: 'bg-tone-tamarind text-tone-tamarind-on', soft: 'text-tone-tamarind-on/90' },
} as const;

export type DocSwatch = {
  key: string;
  label: string;
  value: React.ReactNode;
  note?: string;
  tone: keyof typeof TONES;
  /** Drawn as an outline and not a fill: something that is not there yet. */
  quiet?: boolean;
};

export function DocSwatches({ items, className }: { items: DocSwatch[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={cn('no-print grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.map((s) => {
        const t = TONES[s.tone];
        return (
          <li
            key={s.key}
            className={cn('rounded-card p-4 sm:p-5', s.quiet ? 'border border-dashed border-line-strong text-ink-soft' : t.box)}
          >
            <p className={cn('text-meta', s.quiet ? 'text-ink-mute' : t.soft)}>{s.label}</p>
            <p className="mt-1.5 font-display text-figure font-light tabular-nums">{s.value}</p>
            {s.note && <p className={cn('mt-1 text-meta', s.quiet ? 'text-ink-mute' : t.soft)}>{s.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
