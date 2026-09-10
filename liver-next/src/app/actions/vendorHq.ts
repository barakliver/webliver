'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { noteFailure } from '@/lib/flash';
import { todayInZone } from '@/lib/clock';

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

const dateOrNull = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** The relationship's status, as the producer sets it: whose turn, when we
 *  last spoke, the deposit and its date, the balance date, and the week's
 *  action in their own words. Only the fields the form sent are written. */
export async function updateVendorHq(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) return;

  const patch: Record<string, unknown> = {};
  if (form.has('waiting_on')) {
    const w = String(form.get('waiting_on') ?? '');
    patch.waiting_on = w === 'me' || w === 'them' ? w : null;
  }
  if (form.get('spoke') === 'today') patch.last_contact_on = todayInZone();
  if (form.has('deposit')) {
    const raw = String(form.get('deposit') ?? '').replace(/[^\d.]/g, '');
    const n = raw ? Number(raw) : null;
    patch.deposit = n !== null && Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (form.has('deposit_paid_on')) patch.deposit_paid_on = dateOrNull(form.get('deposit_paid_on'));
  if (form.has('balance_due_on')) patch.balance_due_on = dateOrNull(form.get('balance_due_on'));
  if (form.has('next_action')) patch.next_action = String(form.get('next_action') ?? '').trim().slice(0, 200);
  if (Object.keys(patch).length === 0) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('event_vendors').update(patch).eq('id', id).eq('client_id', clientId);
  if (error) {
    console.error('[vendorHq] update failed', { message: error.message });
    await noteFailure('לא הצלחנו לעדכן את הספק. אפשר לנסות שוב.');
  }
  touch(clientId);
}
