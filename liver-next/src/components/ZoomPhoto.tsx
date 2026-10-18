'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useOverlay } from '@/lib/useOverlay';

/**
 * A picture that opens large when it is pressed.
 *
 * A photographer working from a phone has to know a face well enough to find
 * it across a hall, and a thumbnail the size of a thumb is not that. It asks
 * for no wording of its own - the labels arrive as props - because it sits on
 * a page for somebody who has no account and no provider around it.
 *
 * The thumbnail is whatever the caller draws; this only makes it a button and
 * owns the dialog that opens over it.
 */
export function ZoomPhoto({ src, alt, caption, label, close, className, children }: {
  src: string; alt: string; caption?: string;
  /** Names the button: "enlarge" and what. */
  label: string; close: string; className?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useOverlay(open, () => setOpen(false), panel);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} aria-haspopup="dialog" className={className}>
        {children}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={alt} ref={panel}
          className="fixed inset-0 z-50 grid place-items-center bg-scrim/85 p-4" onClick={() => setOpen(false)}>
          <figure className="pop-in relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[78vh] max-w-full rounded-card object-contain" decoding="async" />
            {caption && <figcaption className="mt-3 text-center text-lead text-surface">{caption}</figcaption>}
          </figure>
          <button type="button" onClick={() => setOpen(false)} aria-label={close}
            className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-surface text-ink">
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
