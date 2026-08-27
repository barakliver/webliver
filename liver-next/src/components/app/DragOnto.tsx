'use client';

import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

/**
 * Picking one thing up and dropping it onto another.
 *
 * The sibling of Sortable: that one reorders a list, this one moves a card
 * from one place to a different place — a guest onto a table, an order into a
 * column. Written on pointer events for the reason that governs every drag in
 * this app: `dragstart` never fires on a touch screen. The seating plan was
 * built on the HTML drag and drop API and therefore did nothing at all on a
 * phone, which is the device it is used on, standing in a venue.
 *
 * Which zone the pointer is over is answered by asking the document what is
 * under that point, rather than by drop events on each zone. One question,
 * asked of the browser, that works identically for a mouse, a finger and a
 * stylus and does not care which way the page runs.
 *
 * Scrolling is the thing this must not break. A finger dragging down a long
 * guest list is scrolling, not lifting, and the only reliable way to tell the
 * two apart is where the finger landed: a grip is for lifting and everything
 * else on the row is for scrolling. So the grip carries `touch-action: none`
 * and nothing else does, and a mouse may grab the whole row because a mouse
 * has a scroll wheel and never had the ambiguity.
 */
export function useDragOnto<T>({ canDrop, onDrop }: {
  /** Whether `item` may land on `zone`. Consulted while moving, so the
   *  highlight is honest before the release rather than an error after it. */
  canDrop?: (item: T, zone: string) => boolean;
  onDrop: (item: T, zone: string) => void;
}) {
  const [item, setItem] = useState<T | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const held = useRef<T | null>(null);

  const start = (value: T) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    held.current = value;
    setItem(value);
    setAt({ x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const track = (e: React.PointerEvent) => {
    if (!held.current) return;
    setAt({ x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const zone = el?.closest<HTMLElement>('[data-drop-zone]')?.dataset.dropZone ?? null;
    const ok = zone !== null && (!canDrop || canDrop(held.current, zone));
    setOver(ok ? zone : null);
  };

  const end = () => {
    const value = held.current;
    const zone = over;
    held.current = null;
    setItem(null);
    setOver(null);
    setAt(null);
    if (value !== null && zone !== null) onDrop(value, zone);
  };

  return {
    /** The thing currently in the air, or null. */
    item,
    /** The zone it is over and may land on, or null. */
    over,
    /** Where the pointer is, for drawing what is being carried. */
    at,

    /** Spread onto the grip. Carries `touch-none`, so a finger that lands here
     *  lifts rather than scrolls. */
    grip: (value: T) => ({
      onPointerDown: start(value),
      onPointerMove: track,
      onPointerUp: end,
      onPointerCancel: end,
    }),

    /** Spread onto the whole row, for a mouse. A finger landing here is
     *  scrolling and is left alone. */
    row: (value: T) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        start(value)(e);
      },
      onPointerMove: track,
      onPointerUp: end,
      onPointerCancel: end,
    }),

    /** Spread onto anything that can be dropped onto. */
    zone: (id: string) => ({ 'data-drop-zone': id }),
  };
}

/** The grip itself, so every draggable row in the app shows the same one and
 *  a finger is never asked to guess where to press. */
export function Grip({ label, ...rest }: { label: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      className="inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-ink-mute transition hover:bg-surface-200 hover:text-ink active:cursor-grabbing"
      {...rest}
    >
      <GripVertical size={15} aria-hidden strokeWidth={1.5} />
    </span>
  );
}

/** What the pointer is carrying, drawn at the pointer. Fixed to the viewport
 *  and out of hit testing, so the document answers with the zone underneath
 *  rather than with the thing being dragged. */
export function Carried({ at, children }: {
  at: { x: number; y: number } | null; children: React.ReactNode;
}) {
  if (!at) return null;
  return (
    <div
      aria-hidden
      style={{ left: at.x, top: at.y }}
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-control border border-accent bg-card px-3 py-1.5 text-[13.5px] text-ink shadow-lift"
    >
      {children}
    </div>
  );
}
