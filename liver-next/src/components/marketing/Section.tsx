import { cn } from '@/lib/utils';

export function Section({
  id, eyebrow, title, sub, children, className, center = false,
}: {
  id?: string; eyebrow?: string; title?: string; sub?: string;
  children?: React.ReactNode; className?: string; center?: boolean;
}) {
  return (
    <section id={id} className={cn('section', className)}>
      <div className="shell">
        {(eyebrow || title || sub) && (
          <header className={cn('mb-8 sm:mb-12', center && 'text-center')}>
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            {title && <h2 className="font-display text-display font-semibold text-ink">{title}</h2>}
            {sub && <p className="measure mt-3 text-[16.5px] text-ink-soft">{sub}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
