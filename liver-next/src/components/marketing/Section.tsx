import { cn } from '@/lib/utils';

export function Section({
  id, eyebrow, title, sub, children, className, center = false, level = 2,
}: {
  id?: string; eyebrow?: string; title?: string; sub?: string;
  children?: React.ReactNode; className?: string; center?: boolean;
  /* A section heading is an h2 on a page that already has an h1 above it,
     which is every page that opens with the hero. The shop opens with a
     section instead, and a page whose first heading is an h2 has a hole where
     its subject should be: a screen reader announces the level and finds
     nothing at the top, and a crawler is told the page is a fragment of
     something else. One page passes 1 for that reason; nothing else should. */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';

  return (
    <section id={id} className={cn('section', className)}>
      <div className="shell">
        {(eyebrow || title || sub) && (
          <header className={cn('mb-10 sm:mb-14', center && 'text-center')}>
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            {title && <Heading className="font-display text-display font-semibold text-ink">{title}</Heading>}
            {sub && <p className="measure mt-3 text-[16.5px] text-ink-soft">{sub}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
