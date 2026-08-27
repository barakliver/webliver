'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

/**
 * Dragging a list into the order somebody wants it in.
 *
 * Written rather than installed, for three reasons that all turned out to
 * matter more than the day of work.
 *
 * The HTML drag and drop API does not exist on touch. Not "works badly" —
 * `dragstart` never fires on a phone, and this product is used on a phone
 * standing in a hall. Pointer events are one API for a mouse, a finger and a
 * stylus, and they are what this is built on.
 *
 * The page is right to left. A library that reasons in `left` and `right`
 * rather than in `start` and `end` mirrors the wrong way on exactly the screens
 * this business uses. Everything here moves vertically and measures from the
 * viewport, so the direction of the page never enters into it.
 *
 * And a list somebody drags is a list somebody else has to reach without a
 * mouse. Every handle is a real button: focus it and the arrow keys move the
 * row, with the same commit at the end. That is not a consolation prize for
 * the keyboard, it is the same feature.
 */

export type SortableRenderProps = {
  /** Spread onto whatever should be grabbable. Usually <Handle />. */
  handle: React.HTMLAttributes<HTMLElement> & { ref: (el: HTMLElement | null) => void };
  dragging: boolean;
  index: number;
};

/** The grab affordance. Its own component so every sortable list in the app
 *  shows the same one and it is never a bare icon nobody knows is draggable. */
export function Handle({
  label, ...rest
}: { label: string } & React.HTMLAttributes<HTMLElement> & { ref?: (el: HTMLElement | null) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex min-h-[44px] w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-ink-mute transition hover:bg-surface-200 hover:text-ink focus-visible:bg-surface-200 active:cursor-grabbing sm:min-h-[36px]"
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      <GripVertical size={16} aria-hidden strokeWidth={1.5} />
    </button>
  );
}

type Item = { id: string };

export function Sortable<T extends Item>({
  items, onReorder, children, className, itemClassName, announce,
}: {
  items: T[];
  /** The new order, ids first to last. Called once, on release. May reject,
   *  in which case the list snaps back to what the server still believes. */
  onReorder: (ids: string[]) => void | Promise<unknown>;
  children: (item: T, props: SortableRenderProps) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  /** Read out when a row moves, for somebody who cannot see it move. Given
   *  the id rather than a name, because only the caller knows what to call
   *  the thing that just moved. */
  announce?: (id: string, at: number, of: number) => string;
}) {
  const [order, setOrder] = useState<T[]>(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [said, setSaid] = useState('');

  const rows = useRef(new Map<string, HTMLElement>());
  const grab = useRef<
    { id: string; from: number; y: number; h: number; tops: number[]; heights: number[] } | null
  >(null);
  const target = useRef(0);

  /* The server is the source of truth between drags. While a drag is in
     progress it is not: the list under the finger is the one being made, and
     a realtime echo of the old order arriving mid-drag would yank it back. */
  useEffect(() => {
    if (!dragId) setOrder(items);
  }, [items, dragId]);

  const commit = useCallback(
    async (next: T[]) => {
      const before = order;
      setOrder(next);
      try {
        await onReorder(next.map((i) => i.id));
      } catch {
        setOrder(before);
      }
    },
    [order, onReorder]
  );

  const move = useCallback(
    (id: string, to: number) => {
      const from = order.findIndex((i) => i.id === id);
      if (from < 0) return;
      const at = Math.max(0, Math.min(order.length - 1, to));
      if (at === from) return;
      const next = order.slice();
      const [row] = next.splice(from, 1);
      next.splice(at, 0, row);
      void commit(next);
      if (announce) setSaid(announce(id, at + 1, next.length));
    },
    [order, commit, announce]
  );

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    /* Left button or a finger. A right click on a handle is somebody reaching
       for a context menu, not starting a drag. */
    if (e.button !== 0) return;
    const el = rows.current.get(id);
    if (!el) return;

    const from = order.findIndex((i) => i.id === id);
    const rects = order.map((i) => rows.current.get(i.id)?.getBoundingClientRect());
    const tops = rects.map((r) => r?.top ?? 0);
    const heights = rects.map((r) => r?.height ?? 0);

    grab.current = {
      id, from, y: e.clientY, h: el.getBoundingClientRect().height, tops, heights,
    };
    target.current = from;
    setDragId(id);
    setOffset(0);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const dy = e.clientY - g.y;
    setOffset(dy);

    /* Where the middle of the dragged row now sits, against where every row
       started. Measured once at grab time rather than every frame, because
       the rows are moving as a consequence of this calculation and reading
       them back would feed the answer into itself. */
    const centre = g.tops[g.from] + g.h / 2 + dy;
    let at = 0;
    for (let i = 0; i < g.tops.length; i += 1) {
      if (centre > g.tops[i] + g.heights[i] / 2) at = i;
    }
    target.current = at;
  };

  const onPointerUp = () => {
    const g = grab.current;
    grab.current = null;
    setDragId(null);
    setOffset(0);
    if (!g) return;
    if (target.current !== g.from) move(g.id, target.current);
  };

  const onKeyDown = (id: string) => (e: React.KeyboardEvent) => {
    const from = order.findIndex((i) => i.id === id);
    if (e.key === 'ArrowUp') { e.preventDefault(); move(id, from - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(id, from + 1); }
    if (e.key === 'Home') { e.preventDefault(); move(id, 0); }
    if (e.key === 'End') { e.preventDefault(); move(id, order.length - 1); }
  };

  /* How far a row that is not the dragged one has to get out of the way. */
  const shiftOf = (index: number): number => {
    const g = grab.current;
    if (!g || !dragId) return 0;
    const to = target.current;
    if (index === g.from) return 0;
    if (g.from < to && index > g.from && index <= to) return -g.h;
    if (g.from > to && index >= to && index < g.from) return g.h;
    return 0;
  };

  return (
    <>
      <ul className={className}>
        {order.map((item, index) => {
          const on = item.id === dragId;
          const shift = on ? offset : shiftOf(index);
          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) rows.current.set(item.id, el);
                else rows.current.delete(item.id);
              }}
              style={{
                transform: shift ? `translateY(${shift}px)` : undefined,
                /* Only the rows getting out of the way animate. The one under
                   the finger must not lag behind it. */
                transition: on ? 'none' : 'transform .16s ease',
                zIndex: on ? 20 : undefined,
                position: on ? 'relative' : undefined,
              }}
              className={`${itemClassName ?? ''} ${on ? 'shadow-lift' : ''}`}
            >
              {children(item, {
                dragging: on,
                index,
                handle: {
                  ref: () => {},
                  onPointerDown: onPointerDown(item.id),
                  onPointerMove,
                  onPointerUp,
                  onPointerCancel: onPointerUp,
                  onKeyDown: onKeyDown(item.id),
                },
              })}
            </li>
          );
        })}
      </ul>

      {/* Somebody who cannot see a row move still has to be told it moved. */}
      <p aria-live="polite" className="sr-only">{said}</p>
    </>
  );
}
