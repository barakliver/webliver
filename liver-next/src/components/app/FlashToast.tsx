'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { FlashTone } from '@/lib/flash';

/**
 * Where the sentence an action left behind is shown: floating, at the foot
 * of the screen, above the phone's bottom bar, and gone on its own.
 *
 * It sat at the top of the content before, which on a long screen was
 * above the fold of the thing that had just been pressed — a person who
 * added a task at the bottom of a list saw nothing happen. Down here it is
 * beside the thumb. A confirmation leaves after a few seconds; a failure
 * stays until it is read, because a failure is the one sentence nobody
 * should have to catch.
 */
export function FlashToast({ tone, children, inline = false }: {
  tone: FlashTone;
  children: ReactNode;
  /** The gallery's way in: drawn in the flow, where a screenshot can hold
   *  it, rather than floating over every other panel. */
  inline?: boolean;
}) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (tone !== 'ok' || inline) return;
    const t = window.setTimeout(() => setShown(false), 6000);
    return () => window.clearTimeout(t);
  }, [tone, inline]);
  if (!shown) return null;
  return (
    <div className={inline
      ? 'w-full max-w-[380px]'
      : 'pointer-events-none fixed inset-x-4 bottom-24 z-50 sm:inset-x-auto sm:bottom-6 sm:end-6 sm:w-[380px]'}>
      <div className="pointer-events-auto shadow-pop">{children}</div>
    </div>
  );
}
