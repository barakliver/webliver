'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { appCopy } from '@/content/site';

/**
 * A panel that rises from the bottom of the screen.
 *
 * The shape a phone expects for a short, self-contained task: it arrives from
 * the edge a thumb is already near, it does not lose the screen behind it, and
 * it closes by tapping away rather than by finding a control.
 *
 * Four things a sheet has to get right and most do not:
 *
 *   the backdrop closes it, the sheet itself does not, which is why the click
 *   handler is on the backdrop alone rather than on a wrapper both share
 *
 *   Escape closes it, because a keyboard is not only a desktop thing and a
 *   modal with no keyboard exit is a trap
 *
 *   focus moves into it on open and returns to whatever opened it on close,
 *   so somebody navigating by keyboard is not dropped at the top of the page
 *
 *   the page behind stops scrolling, or a swipe meant for the sheet scrolls
 *   the document under it and the sheet appears frozen
 */
export function Sheet({
  open, onClose, title, sub, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    opener.current = document.activeElement;
    const scrollY = window.scrollY;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey);

    /* After paint, or the element is not focusable yet. */
    const id = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      )?.focus();
    });

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      window.scrollTo(0, scrollY);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={appCopy.sheets.close}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/30"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /* 30px, which is the design source's own sheet radius, and rounded
           only on the edge it does not come from: a bottom sheet whose lower
           corners are curved looks like it is floating rather than like it
           slid up from the edge of the screen. */
        className="animate-sheet relative max-h-[88svh] w-full max-w-lg overflow-y-auto
                   rounded-t-sheet border-t border-line bg-card p-5 shadow-fab
                   sm:rounded-sheet sm:border sm:p-7"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        {/* The grab handle. Decorative here, and the reason it stays is that it
            is the one visual cue that says which edge this came from. */}
        <span aria-hidden className="mx-auto mb-5 block h-1 w-10 bg-line-strong sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-ink">{title}</h2>
            {sub && <p className="mt-1.5 text-[14px] text-ink-soft">{sub}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={appCopy.sheets.close}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-mute
                       transition-colors duration-300 hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <hr className="rule-gold my-5" />
        {children}
      </div>
    </div>
  );
}
