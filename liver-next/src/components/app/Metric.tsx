import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The number a screen is about, at the size the design gives it.
 *
 * This composition existed in exactly one place in the product: inside the
 * phone on the landing page, which was built directly from the handoff. Every
 * other screen carried the palette and the serif and then set its headline
 * number at `text-[22px]`, so the tokens were right and the screens still did
 * not look like the design. `text-metric` and `text-metric-sm` were defined in
 * the config and used zero times.
 *
 * The shape, from the handoff:
 *
 *     kicker    small, tracked, quiet
 *     NUMERAL   serif, light, leading-none, large enough to be the anchor
 *     sub       one line of context, quiet
 *
 * Weight is always 300. The serif is never bold here; at these sizes bold
 * turns a figure into a shout, and the whole palette is built the other way.
 */

type Size = 'lead' | 'tile';
type Tone = 'ink' | 'accent' | 'ok' | 'warn' | 'bad';

/* Large text clears AA at 3:1 rather than 4.5:1, which is the whole reason
   `accent-bright` exists: the readable-as-words gold is too dark to sing at
   62px, and the decorative one cannot carry a number that means something.
   Every pairing here is measured in scripts/check-contrast.mjs. */
const TONE: Record<Tone, string> = {
  ink:    'text-ink',
  accent: 'text-accent-bright',
  ok:     'text-ok',
  warn:   'text-warn',
  bad:    'text-bad',
};

const SIZE: Record<Size, string> = {
  /* 62px. One to a screen: the thing the screen is answering. */
  lead: 'text-metric',
  /* 42px. A row of three or four read as a set. */
  tile: 'text-metric-sm',
};

export function Metric({
  kicker, value, sub, size = 'tile', tone = 'ink', className,
}: {
  kicker?: string;
  /** Already isolated where it needs to be: <Money>, <Ratio>, or a bare count. */
  value: ReactNode;
  sub?: ReactNode;
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {kicker && <p className="eyebrow">{kicker}</p>}
      {/* No `leading-none` here: each size token carries its own line-height
          (1 at 62px, 1.05 at 42px) and a later font-size wins that conflict
          anyway, so writing it would only look like it did something. */}
      <p className={cn(
        'font-display font-light tabular-nums',
        SIZE[size], TONE[tone], kicker && 'mt-3',
      )}>
        {value}
      </p>
      {sub && <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-mute">{sub}</p>}
    </div>
  );
}

/**
 * The list under a metric: a label on one side, a figure on the other, a
 * hairline between each. The handoff's own structure, and the reason the
 * palette has no cards.
 */
export function MetricRows({ rows, className }: {
  rows: { label: string; value: ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <ul className={cn('list-none p-0', className)}>
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0"
        >
          <span className="text-[14px] text-ink-soft">{row.label}</span>
          <span className={cn(
            'font-display text-[17px] font-light tabular-nums',
            TONE[row.tone ?? 'ink'],
          )}>
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A metric with its own supporting rows, which is how most screens use it. */
export function MetricBlock({
  kicker, value, sub, rows, size = 'tile', tone = 'ink', className,
}: {
  kicker?: string;
  value: ReactNode;
  sub?: ReactNode;
  rows?: { label: string; value: ReactNode; tone?: Tone }[];
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <Metric kicker={kicker} value={value} sub={sub} size={size} tone={tone} />
      {rows && rows.length > 0 && (
        <>
          <hr className="rule-gold my-5" />
          <MetricRows rows={rows} />
        </>
      )}
    </div>
  );
}
