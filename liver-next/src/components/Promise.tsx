import { PROMISE } from '@/content/site';
import { cn } from '@/lib/utils';

/**
 * His line, set the way a line like that should be set.
 *
 * Small, tracked open, in the accent, with a gold rule running out to either
 * side and fading. It is not a heading and it is not a slogan in a box: it sits
 * under a name the way an engraving sits under a portrait, and it is meant to
 * be noticed once and then simply be there.
 *
 * The text comes from one constant rather than being typed at each site. A
 * sentence that is copied is a sentence that eventually differs, and this one
 * is his, word for word.
 *
 * `aria-hidden` is deliberate on the decorative rules only; the line itself is
 * read, because it is the one thing on some of these screens that says what
 * this business is for.
 */
export function PromiseLine({ className = '', tone = 'accent', text = PROMISE }: {
  className?: string;
  /** `accent` on a light ground, `light` on the dark one. */
  tone?: 'accent' | 'light';
  /** What the line says. The default is his Hebrew, unchanged and not ours to
   *  edit. English screens pass the English site's own version of it, because
   *  a line whose whole job is to be understood at a glance does not do that
   *  job in a script the reader cannot read. Nothing here rewrites the Hebrew:
   *  it chooses which of the two already written lines an English reader is
   *  shown. */
  text?: string;
}) {
  const ink = tone === 'light' ? 'text-accent-light' : 'text-accent';
  /* A plain hairline rather than a gradient fading at both ends: the brief
     removes every gradient, and a rule that is simply a rule reads as
     quieter than one pretending to dissolve. */
  const rule = tone === 'light' ? 'bg-accent-light/45' : 'bg-accent-line/55';

  return (
    <p className={cn('flex items-center justify-center gap-3', className)}>
      <span aria-hidden className={cn('h-px w-8 sm:w-12', rule)} />
      <span className={cn('font-sans text-body font-medium tracking-[.16em] whitespace-nowrap', ink)}>
        {text}
      </span>
      <span aria-hidden className={cn('h-px w-8 sm:w-12', rule)} />
    </p>
  );
}
