'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { placeOrder } from '@/app/actions/shop';
import type { ShopCopy } from '@/content/ui';
import { Money, Ltr } from '@/components/Ltr';

export type ShopItem = {
  id: string; name: string; blurb: string; body: string;
  price: number; kind: 'product' | 'service'; image: string;
};

/**
 * The shop, as somebody who has never met this business sees it.
 *
 * No card is charged. That is not a limitation dressed up as a feature: this
 * business closes on the phone, and a checkout that asks for a card before
 * anybody has agreed a date would lose the order rather than take the money.
 * What this does is turn "I think I want the bar package" into a record with a
 * name and a number on it, sitting in front of the producer within a second.
 *
 * The basket lives in this component and nowhere else. Nothing is written down
 * until somebody presses send, so closing the tab costs a visitor nothing and
 * leaves no half-order behind for anybody to chase.
 */
/* The wording arrives as a prop rather than being imported here. This is a
   client component, so importing the copy would ship both languages to every
   visitor and still render the wrong one: the language lives in a cookie the
   server has already read. */
export function Shop({ producerId, items, copy: c }: {
  producerId: string; items: ShopItem[]; copy: ShopCopy;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const lines = useMemo(
    () => items.filter((i) => cart[i.id] > 0).map((i) => ({ ...i, qty: cart[i.id] })),
    [items, cart]
  );
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  const set = (id: string, qty: number) =>
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(99, qty);
      return next;
    });

  const send = async (form: FormData) => {
    setBusy(true);
    setError('');
    const res = await placeOrder({
      producerId,
      items: lines.map((l) => ({ id: l.id, qty: l.qty })),
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      note: String(form.get('note') ?? ''),
    });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? c.failed); return; }
    setCart({});
    setOpen(false);
    setDone(res.number ?? '');
  };

  if (done !== null) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <h2 className="font-display text-[26px] font-semibold text-ink">{c.thanksTitle}</h2>
        <p className="mt-3 text-[15px] text-ink-soft">{c.thanks}</p>
        <p className="mt-2 font-display text-[24px] text-accent"><Ltr>{done}</Ltr></p>
        <button type="button" onClick={() => setDone(null)} className="btn-quiet mt-5 text-[14.5px]">
          {c.again}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-center text-[15px] text-ink-mute">{c.shopEmpty}</p>;
  }

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const qty = cart[i.id] ?? 0;
          return (
            <li key={i.id} className="card flex flex-col overflow-hidden p-0">
              {i.image && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={i.image} alt="" className="h-44 w-full object-cover" loading="lazy" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11.5px] tracking-[.14em] text-ink-mute">
                  {i.kind === 'service' ? c.kindService : c.kindProduct}
                </p>
                <h3 className="mt-1.5 font-display text-[20px] font-semibold text-ink">{i.name}</h3>
                {i.blurb && <p className="mt-1.5 text-[14px] text-ink-soft">{i.blurb}</p>}
                {i.body && <p className="mt-2 whitespace-pre-line text-[13.5px] text-ink-mute">{i.body}</p>}

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <Money value={i.price} className="font-display text-[20px] text-ink" />

                  {qty === 0 ? (
                    <button type="button" onClick={() => set(i.id, 1)} className="btn-primary">
                      {c.addToCart}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-button border border-line-strong p-1">
                      <Step label="-" onClick={() => set(i.id, qty - 1)}><Minus size={15} aria-hidden strokeWidth={1.5} /></Step>
                      <span className="min-w-8 text-center text-[15px] tabular-nums text-ink" aria-label={c.qty}>
                        <Ltr>{qty}</Ltr>
                      </span>
                      <Step label="+" onClick={() => set(i.id, qty + 1)}><Plus size={15} aria-hidden strokeWidth={1.5} /></Step>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* The basket, on the edge of the screen, only once there is one. */}
      {count > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary fixed bottom-5 end-5 z-40 inline-flex items-center gap-2 shadow-cta"
        >
          <ShoppingBag size={17} aria-hidden strokeWidth={1.5} />
          {c.cart}
          <span className="rounded-control bg-card/25 px-2 text-[13px] tabular-nums"><Ltr>{count}</Ltr></span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-dark/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog" aria-modal="true" aria-label={c.cart}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-sheet border border-line bg-card p-5 sm:rounded-sheet"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-[22px] font-semibold text-ink">{c.cart}</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-quiet px-2 py-1" aria-label={c.cancel}>
                <X size={18} aria-hidden strokeWidth={1.5} />
              </button>
            </div>

            <ul className="mt-4 divide-y divide-line border-y border-line">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] text-ink">{l.name}</p>
                    <Money value={l.price} className="text-[13px] text-ink-mute" />
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-button border border-line-strong p-1">
                    <Step label="-" onClick={() => set(l.id, l.qty - 1)}><Minus size={14} aria-hidden strokeWidth={1.5} /></Step>
                    <span className="min-w-7 text-center text-[14px] tabular-nums text-ink"><Ltr>{l.qty}</Ltr></span>
                    <Step label="+" onClick={() => set(l.id, l.qty + 1)}><Plus size={14} aria-hidden strokeWidth={1.5} /></Step>
                  </div>
                  <Money value={l.price * l.qty} className="w-20 shrink-0 text-end text-[14.5px] text-ink" />
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-[14px] text-ink-soft">{c.total}</span>
              <Money value={total} className="font-display text-[24px] text-ink" />
            </div>

            <form action={send} className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="name" required maxLength={200} placeholder={c.buyerName} aria-label={c.buyerName} className="field" autoComplete="name" />
                <input name="phone" inputMode="tel" maxLength={60} placeholder={c.buyerPhone} aria-label={c.buyerPhone} className="field" autoComplete="tel" />
              </div>
              <input name="email" type="email" maxLength={200} placeholder={c.buyerEmail} aria-label={c.buyerEmail} className="field w-full" autoComplete="email" />
              <textarea name="note" rows={3} maxLength={2000} placeholder={c.buyerNotePh} aria-label={c.buyerNote} className="field w-full resize-y" />

              <p className="text-[13px] text-ink-mute">{c.payLater}</p>

              {error && <p role="alert" className="rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{error}</p>}

              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => { setCart({}); setOpen(false); }} className="btn-quiet text-[14px]">
                  {c.clear}
                </button>
                <button type="submit" className="btn-primary disabled:opacity-60" disabled={busy}>
                  {busy ? c.sending : c.checkout}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label}
      className="grid size-8 place-items-center rounded-control text-ink-soft transition hover:bg-surface-200 hover:text-ink"
    >
      {children}
    </button>
  );
}
