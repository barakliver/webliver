import type { CSSProperties } from 'react';

/**
 * A figure that counts up to itself when the page opens.
 *
 * The moving digits are generated content on a registered CSS property, so
 * the markup is a single span and a server render is already correct; the
 * real number sits beside it for anything that reads text, and the moving one
 * is hidden from it.
 */
export function CountUp({ n, className, prefix }: { n: number; className?: string; prefix?: string }) {
  return (
    <span dir="ltr" className="tabular-nums" style={{ unicodeBidi: 'isolate' }}>
      {prefix && <span aria-hidden>{prefix}</span>}
      <span aria-hidden className={`count-up ${className ?? ''}`} style={{ '--to': Math.max(0, Math.round(n)) } as CSSProperties} />
      <span className="sr-only">{prefix}{n.toLocaleString('en-US')}</span>
    </span>
  );
}
