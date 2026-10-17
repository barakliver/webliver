import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A row of figures, said quietly.
 *
 * The brief's summary bar: a small label above each number, the number in
 * the display face at 300, forty pixels of air between figures and no
 * lines between them, and under the row an optional three-pixel bar that
 * says how far along something is. Sticky when asked, so the three
 * numbers a screen exists for are there while the rest scrolls.
 *
 * Numbers arrive already isolated (<Money>, <Ratio>, a bare count); this
 * draws and does not format.
 */
export type Stat = { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ink' | 'bad' | 'ok' };

export function StatBar({ stats, progress, sticky = false, className }: {
  stats: Stat[];
  /** 0 to 1. Above 1 the bar turns the danger colour, which is the one
   *  time this component uses a colour at all. */
  progress?: number | null;
  sticky?: boolean;
  className?: string;
}) {
  const over = typeof progress === 'number' && progress > 1;
  const width = typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) * 100 : null;
  return (
    <section
      className={cn(
        'border-b border-line bg-card px-4 py-4 sm:px-6',
        sticky && 'sticky top-0 z-20',
        className,
      )}
      aria-label={stats.map((s) => s.label).join(' · ')}
    >
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-[96px]">
            <dt className="text-micro text-ink-mute">{s.label}</dt>
            <dd className={cn(
              'mt-1 font-display text-figure font-light leading-none tabular-nums sm:text-[34px]',
              s.tone === 'bad' ? 'text-bad' : s.tone === 'ok' ? 'text-ok' : 'text-ink',
            )}>
              {s.value}
            </dd>
            {s.sub && <dd className="mt-1 text-meta text-ink-mute">{s.sub}</dd>}
          </div>
        ))}
      </dl>
      {width !== null && (
        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-line" role="presentation">
          <div className={cn('h-full rounded-full transition-[width] duration-slow ease-out', over ? 'bg-bad' : 'bg-accent')} style={{ width: `${width}%` }} />
        </div>
      )}
    </section>
  );
}
