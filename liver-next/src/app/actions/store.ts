'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';

export type StoreResult = { ok: boolean; error?: string };

const refresh = () => {
  revalidatePath('/app/store');
  revalidatePath('/store');
};

const price = (raw: FormDataEntryValue | null): number => {
  const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** A new thing for sale, or an edit to one. The same action for both, because
 *  the form is the same form and a separate create path is where the two
 *  quietly stop validating the same way. */
export async function saveProduct(_prev: StoreResult | null, form: FormData): Promise<StoreResult> {
  const id = String(form.get('id') ?? '');
  const name = String(form.get('name') ?? '').trim().slice(0, 160);
  const blurb = String(form.get('blurb') ?? '').trim().slice(0, 300);
  const body = String(form.get('body') ?? '').trim().slice(0, 6000);
  const kindRaw = String(form.get('kind') ?? 'product');
  const kind = kindRaw === 'service' ? 'service' : 'product';
  const image = String(form.get('image_path') ?? '').trim().slice(0, 400);
  const active = form.get('active') !== null;

  if (name.length < 1) return { ok: false, error: 'צריך שם למוצר' };

  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: 'אין מרחב הפקה פעיל' };

  const sb = await supabaseServer();
  const fields = { name, blurb, body, kind, price: price(form.get('price')), active, image_path: image };

  if (id) {
    const { error } = await sb.from('products').update(fields).eq('id', id);
    if (error) return { ok: false, error: 'לא הצלחנו לשמור את השינוי' };
  } else {
    /* New rows land at the end rather than at the top. A producer adding a
       fourth package does not mean it should be the first thing a visitor
       reads, and the drag handle is right there if they disagree. */
    const { data: last } = await sb
      .from('products').select('sort_order')
      .eq('producer_id', producerId)
      .order('sort_order', { ascending: false }).limit(1).maybeSingle();

    const { error } = await sb.from('products').insert({
      ...fields,
      producer_id: producerId,
      sort_order: (last?.sort_order ?? 0) + 1,
    });
    if (error) return { ok: false, error: 'לא הצלחנו להוסיף את המוצר' };
  }

  refresh();
  return { ok: true };
}

/** On or off the shop, without opening the form. This is the one edit a
 *  producer makes in a hurry: a package sold out on a Friday. */
export async function toggleProduct(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const active = String(form.get('active') ?? '') === 'true';
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('products').update({ active }).eq('id', id);
  refresh();
}

export async function deleteProduct(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('products').delete().eq('id', id);
  refresh();
}

/** The result of a drag, in one call. The database writes every row in one
 *  statement, so a reorder either lands whole or does not land. */
export async function reorderProducts(ids: string[]): Promise<StoreResult> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
  if (ids.length > 500) return { ok: false, error: 'יותר מדי שורות' };
  if (!ids.every((id) => /^[0-9a-f-]{36}$/i.test(id))) {
    return { ok: false, error: 'סדר לא תקין' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.rpc('reorder_products', { p_ids: ids });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את הסדר' };

  refresh();
  return { ok: true };
}

const STATES = ['draft', 'pending', 'paid', 'refunded'] as const;
export type OrderState = (typeof STATES)[number];

/** Moving an order between columns. The same call whether it was dragged or
 *  chosen from the menu, so the two cannot mean different things. */
export async function setOrderStatus(id: string, status: string): Promise<StoreResult> {
  if (!id) return { ok: false, error: 'חסר מזהה הזמנה' };
  if (!(STATES as readonly string[]).includes(status)) {
    return { ok: false, error: 'סטטוס לא מוכר' };
  }
  const sb = await supabaseServer();
  const { error } = await sb.from('orders').update({ status }).eq('id', id);
  if (error) return { ok: false, error: 'לא הצלחנו לעדכן את ההזמנה' };
  refresh();
  return { ok: true };
}

export async function noteOrder(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const note = String(form.get('note') ?? '').trim().slice(0, 2000);
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('orders').update({ note }).eq('id', id);
  refresh();
}
