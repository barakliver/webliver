'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { setOrderStatus, noteOrder, type OrderState } from '@/app/actions/store';
import { storeCopy as c } from '@/content/site';
import { Money, Ltr } from '@/components/Ltr';

export type OrderLine = { id: string; name: string; qty: number; price: number; line: number };

export type Order = {
  id: string;
  number: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  items: OrderLine[];
  total: number;
  status: OrderState;
  note: string;
  created_at: string;
};

const COLUMNS: OrderState[] = ['pending', 'paid', 'draft', 'refunded'];

const TONE: Record<OrderState, string> = {
  pending:  'text-warn',
  paid:     'text-ok',
  draft:    'text-ink-mute',
  refunded: 'text-ink-mute',
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });

/**
 * Orders as four columns somebody moves cards between.
 *
 * The drag is written on pointer events rather than the HTML drag and drop
 * API, for the same reason the sortable list is: `dragstart` never fires on a
 * touch screen, and an order gets marked paid on a phone far more often than
 * on a laptop. Which column the finger is over is answered by asking the
 * document what is under that point, so it works the same for a mouse, a
 * finger and a stylus, and it does not care which way the page runs.
 *
 * Every card also carries a plain menu of the four states. Not a fallback —
 * it is faster than dragging when the board is long, and it is the only way
 * through for somebody using a keyboard or a screen reader.
 */
export function OrdersBoard({ orders }: { orders: Order[] }) {
  const [rows, setRows] = useState(orders);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<OrderState | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const from = useRef<OrderState | null>(null);

  useEffect(() => { if (!dragId) setRows(orders); }, [orders, dragId]);

  const moveTo = async (id: string, status: OrderState) => {
    const before = rows;
    setRows((list) => list.map((o) => (o.id === id ? { ...o, status } : o)));
    const res = await setOrderStatus(id, status);
    if (!res.ok) setRows(before);
  };

  const grab = (o: Order) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    from.current = o.status;
    setDragId(o.id);
    setGhost({ x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const track = (e: React.PointerEvent) => {
    if (!dragId) return;
    setGhost({ x: e.clientX, y: e.clientY });
    /* Ask the document what is under the finger. The card itself is captured
       and out of the way, so what comes back is the column beneath it. */
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const zone = el?.closest<HTMLElement>('[data-drop-state]');
    setOver((zone?.dataset.dropState as OrderState) ?? null);
  };

  const drop = () => {
    const id = dragId;
    const to = over;
    setDragId(null);
    setGhost(null);
    setOver(null);
    if (id && to && to !== from.current) void moveTo(id, to);
    from.current = null;
  };

  const dragged = rows.find((o) => o.id === dragId) ?? null;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[22px] font-semibold text-ink">{c.tabOrders}</h2>
        <p className="text-[13.5px] text-ink-mute">{c.ordersHint}</p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.noneOrders}</p>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const inCol = rows.filter((o) => o.status === col);
            return (
              <div
                key={col}
                data-drop-state={col}
                className={`rounded-card-sm border p-3 transition ${
                  over === col && dragId
                    ? 'border-accent bg-accent-wash'
                    : 'border-line bg-surface-100'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-[13px] ${TONE[col]}`}>{c.state[col]}</p>
                  <span className="text-[12.5px] tabular-nums text-ink-mute">{inCol.length}</span>
                </div>

                <ul className="mt-3 space-y-2">
                  {inCol.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-control border border-line bg-card p-3 transition ${
                        o.id === dragId ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          aria-label={c.moveTo}
                          onPointerDown={grab(o)}
                          onPointerMove={track}
                          onPointerUp={drop}
                          onPointerCancel={drop}
                          /* A 15px handle was the only way to move an order by touch, and a
                             15px handle cannot be gripped by a finger at all. The icon stays
                             small; the button around it is a finger's width on a phone. */
                          className="-my-1.5 grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center text-ink-mute transition hover:text-ink active:cursor-grabbing sm:my-0 sm:h-8 sm:w-6"
                        >
                          <GripVertical size={15} aria-hidden strokeWidth={1.5} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setOpen(open === o.id ? null : o.id)}
                          className="min-w-0 flex-1 text-start"
                          aria-expanded={open === o.id}
                        >
                          <p className="truncate text-[14.5px] text-ink">{o.buyer_name}</p>
                          <p className="mt-0.5 text-[12px] text-ink-mute">
                            <Ltr>{o.number}</Ltr> · {dateFmt.format(new Date(o.created_at))}
                          </p>
                          <Money value={o.total} className="mt-1 block text-[14px] text-ink" />
                        </button>
                      </div>

                      {open === o.id && (
                        <div className="mt-3 space-y-3 border-t border-line pt-3">
                          <ul className="space-y-1">
                            {o.items.map((l, i) => (
                              <li key={`${l.id}-${i}`} className="flex items-baseline justify-between gap-2 text-[13.5px]">
                                <span className="min-w-0 truncate text-ink-soft">{l.name}</span>
                                <span className="shrink-0 text-ink-mute">
                                  <Ltr>×{l.qty}</Ltr>
                                </span>
                                <Money value={l.line} className="shrink-0 text-ink" />
                              </li>
                            ))}
                          </ul>

                          {(o.buyer_phone || o.buyer_email) && (
                            <p className="text-[13px] text-ink-soft">
                              {o.buyer_phone && (
                                <a href={`tel:${o.buyer_phone}`} className="transition hover:text-accent">
                                  <Ltr>{o.buyer_phone}</Ltr>
                                </a>
                              )}
                              {o.buyer_phone && o.buyer_email && ' · '}
                              {o.buyer_email && (
                                <a href={`mailto:${o.buyer_email}`} className="transition hover:text-accent">
                                  <Ltr>{o.buyer_email}</Ltr>
                                </a>
                              )}
                            </p>
                          )}

                          <label className="block text-[12.5px] text-ink-mute">
                            {c.moveTo}
                            <select
                              value={o.status}
                              onChange={(e) => void moveTo(o.id, e.target.value as OrderState)}
                              className="field mt-1 w-full"
                            >
                              {COLUMNS.map((s) => (
                                <option key={s} value={s}>{c.state[s]}</option>
                              ))}
                            </select>
                          </label>

                          <form action={noteOrder} className="flex gap-2">
                            <input type="hidden" name="id" value={o.id} />
                            <input
                              name="note" defaultValue={o.note} maxLength={2000}
                              placeholder={c.orderNotePh} aria-label={c.orderNote}
                              className="field flex-1" autoComplete="off"
                            />
                            <button type="submit" className="btn-quiet whitespace-nowrap px-3 text-[13.5px]">
                              {c.save}
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* What the finger is carrying. Fixed to the viewport and out of the way
          of hit testing, so elementFromPoint answers with the column under it
          rather than with the card itself. */}
      {dragged && ghost && (
        <div
          aria-hidden
          style={{ left: ghost.x, top: ghost.y }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-control border border-accent bg-card px-3 py-2 shadow-lift"
        >
          <p className="text-[14px] text-ink">{dragged.buyer_name}</p>
          <Money value={dragged.total} className="text-[13px] text-ink-mute" />
        </div>
      )}
    </section>
  );
}
