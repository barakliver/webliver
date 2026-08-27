'use server';

import { supabasePublic } from '@/lib/supabase/public';

export type PlaceResult = { ok: boolean; number?: string; error?: string };

/**
 * A visitor's order, sent from a page with nobody signed in.
 *
 * Everything about what it costs is decided in the database. The items that
 * travel from here are ids and quantities and nothing else — no prices, no
 * names, no totals — because place_order() reads the catalogue itself and
 * sums it itself. Every storefront that has ever trusted a posted price has
 * eventually sold something for a shekel.
 *
 * Sent through the anonymous client rather than the request-scoped one: this
 * runs on a page a stranger is reading, and it needs exactly the rights a
 * stranger has.
 */
export async function placeOrder(input: {
  producerId: string;
  items: { id: string; qty: number }[];
  name: string;
  phone?: string;
  email?: string;
  note?: string;
}): Promise<PlaceResult> {
  const items = (input.items ?? [])
    .filter((i) => /^[0-9a-f-]{36}$/i.test(i.id))
    .slice(0, 30)
    .map((i) => ({ id: i.id, qty: Math.max(1, Math.min(99, Math.round(Number(i.qty) || 1))) }));

  if (items.length === 0) return { ok: false, error: 'הסל ריק' };
  if (!/^[0-9a-f-]{36}$/i.test(input.producerId)) return { ok: false, error: 'החנות לא נמצאה' };

  const sb = supabasePublic();
  const { data, error } = await sb.rpc('place_order', {
    p_producer: input.producerId,
    p_items: items,
    p_name: String(input.name ?? '').slice(0, 200),
    p_phone: String(input.phone ?? '').slice(0, 60),
    p_email: String(input.email ?? '').slice(0, 200),
    p_note: String(input.note ?? '').slice(0, 2000),
  });

  /* The database raises with the sentence a visitor should read — a missing
     name, an empty basket, a product that sold out while they were looking at
     it. Passing it through is more use than a generic failure, and there is
     nothing in it they did not already know. */
  if (error) return { ok: false, error: error.message || 'לא הצלחנו לשלוח את ההזמנה' };

  return { ok: true, number: String(data ?? '') };
}
