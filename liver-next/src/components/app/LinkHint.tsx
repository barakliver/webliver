'use client';

import { useLinkStatus } from 'next/link';

/**
 * A dot that appears inside a link only while its navigation is taking time.
 *
 * Must sit inside a `<Link>`; that is where the hook reads from. Always
 * rendered at a fixed size and merely made visible, so it never shifts the
 * label beside it. The delay before it shows lives in the stylesheet, which
 * is why a navigation that lands within a frame or two never flashes it.
 */
export function LinkHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint${pending ? ' is-pending' : ''}`} />;
}
