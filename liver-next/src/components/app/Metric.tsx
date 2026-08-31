import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
 *
 * A figure that means something has somewhere to go. Give any of these an
 * `href` and the whole block becomes the way in: 12 open tasks is a question,
 * and the answer is the list of them. Because every number in the product is
 * drawn through this file, that is one prop rather than one decision per
 * screen — and a number with nowhere useful to go simply does not get one,
 * which is why it stays optional.
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

/**
 * The block, linked or not.
 *
 * No fill and no card behind it when it is a link. The palette has no cards,
 * and a figure that grows a grey panel on hover is the one place the whole
 * design would suddenly look like a dashboard. What says "this goes somewhere"
 * is the gold arriving on the numeral and the chevron sliding in, which is the
 * same language the rest of the product uses for a way through.
 */
function Shell({ href, onClick, label, className, children }: {
  href?: string; onClick?: () => void; label?: string; className?: string; children: ReactNode;
}) {
  const shared = cn(
    'group/metric block w-full min-w-0 rounded-xl2 text-start',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
    'focus-visible:outline-accent',
    className,
  );
  /* Not every figure's detail is on another screen. A guest count's detail is
     the list directly underneath it, and the right thing there is to filter
     that list rather than navigate away from it — same affordance, same
     arrow, no page load. A button, because it is not a destination, and a
     screen reader should not be told it is one. */
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className={shared}>
        {children}
      </button>
    );
  }
  if (!href) return <div className={cn('min-w-0', className)}>{children}</div>;
  return (
    <Link
      href={href}
      /* The accessible name is the question, not the digits. A screen reader
         reaching a bare "12" link has been told nothing about where it goes. */
      aria-label={label}
      className={shared}
    >
      {children}
    </Link>
  );
}

/** The arrow, on a linked one only. Written as a prop rather than as a
 *  descendant selector on the link class: a rule that reaches up the tree to
 *  decide whether a thing renders is a rule nobody finds when it stops
 *  working. */
function Way({ on }: { on?: boolean }) {
  if (!on) return null;
  return (
    <ChevronLeft
      size={15}
      strokeWidth={1.5}
      aria-hidden
      className="chev-onward shrink-0 opacity-0 transition-all duration-200
                 group-hover/metric:-translate-x-1 group-hover/metric:opacity-100
                 group-focus-visible/metric:opacity-100"
    />
  );
}

export function Metric({
  kicker, value, sub, size = 'tile', tone = 'ink', href, onClick, label, className,
}: {
  kicker?: string;
  /** Already isolated where it needs to be: <Money>, <Ratio>, or a bare count. */
  value: ReactNode;
  sub?: ReactNode;
  size?: Size;
  tone?: Tone;
  /** Where this figure is explained. Makes the whole block the way in. */
  href?: string;
  /** Or, when the detail is on this same screen, what to do instead. */
  onClick?: () => void;
  /** What to call that way in, if the kicker is not enough on its own. */
  label?: string;
  className?: string;
}) {
  return (
    <Shell href={href} onClick={onClick} label={label ?? kicker} className={className}>
      {kicker && (
        <p className="eyebrow flex items-center gap-1.5">
          {kicker}
          <Way on={!!href || !!onClick} />
        </p>
      )}
      {/* No `leading-none` here: each size token carries its own line-height
          (1 at 62px, 1.05 at 42px) and a later font-size wins that conflict
          anyway, so writing it would only look like it did something. */}
      <p className={cn(
        'font-display font-light tabular-nums transition-colors duration-200',
        SIZE[size], TONE[tone], kicker && 'mt-3',
        (href || onClick) && 'group-hover/metric:text-accent-bright',
      )}>
        {value}
      </p>
      {sub && <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-mute">{sub}</p>}
    </Shell>
  );
}

/**
 * The list under a metric: a label on one side, a figure on the other, a
 * hairline between each. The handoff's own structure, and the reason the
 * palette has no cards.
 *
 * A row carries its own `href` rather than inheriting the block's, because
 * these rows are usually the breakdown: paid and owed and overdue do not go
 * to the same screen, and sending all three to the same place would be worse
 * than sending none of them anywhere.
 */
export type Row = { label: string; value: ReactNode; tone?: Tone; href?: string };

export function MetricRows({ rows, className }: { rows: Row[]; className?: string }) {
  return (
    <ul className={cn('list-none p-0', className)}>
      {rows.map((row) => {
        const body = (
          <>
            <span className="flex items-center gap-1.5 text-[14px] text-ink-soft">
              {row.label}
              <Way on={!!row.href} />
            </span>
            <span className={cn(
              'font-display text-[17px] font-light tabular-nums transition-colors duration-200',
              TONE[row.tone ?? 'ink'],
              row.href && 'group-hover/metric:text-accent-bright',
            )}>
              {row.value}
            </span>
          </>
        );
        return (
          <li key={row.label} className="border-b border-line last:border-0">
            {row.href ? (
              <Link
                href={row.href}
                className="group/metric flex items-baseline justify-between gap-4 py-3
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-accent"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-baseline justify-between gap-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A metric with its own supporting rows, which is how most screens use it. */
export function MetricBlock({
  kicker, value, sub, rows, size = 'tile', tone = 'ink', href, label, className,
}: {
  kicker?: string;
  value: ReactNode;
  sub?: ReactNode;
  rows?: Row[];
  size?: Size;
  tone?: Tone;
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <Metric kicker={kicker} value={value} sub={sub} size={size} tone={tone} href={href} label={label} />
      {rows && rows.length > 0 && (
        <>
          <hr className="rule-gold my-5" />
          <MetricRows rows={rows} />
        </>
      )}
    </div>
  );
}
