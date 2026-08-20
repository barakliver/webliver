'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type GuestResult = { ok: boolean; error?: string; added?: number };

export const DIETS = [
  { value: 'none',        label: 'רגיל' },
  { value: 'vegetarian',  label: 'צמחוני' },
  { value: 'vegan',       label: 'טבעוני' },
  { value: 'gluten_free', label: 'ללא גלוטן' },
  { value: 'kosher',      label: 'כשר' },
] as const;

export const RSVP_LABELS: Record<string, string> = {
  pending: 'טרם ענו',
  attending: 'מגיעים',
  declined: 'לא מגיעים',
};

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

/** Guests arrive by the handful, not one at a time, so the form takes a
 *  pasted list: one guest per line, optionally "name, side, phone". */
export async function addGuests(_prev: GuestResult | null, form: FormData): Promise<GuestResult> {
  const clientId = String(form.get('client_id') ?? '');
  const bulk = String(form.get('names') ?? '');
  const side = String(form.get('side') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const rows = bulk
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, lineSide, phone] = line.split(',').map((p) => (p ?? '').trim());
      return {
        client_id: clientId,
        full_name: name,
        side: lineSide || side,
        phone: phone || '',
      };
    })
    .filter((r) => r.full_name.length >= 2);

  if (rows.length === 0) return { ok: false, error: 'נא לכתוב לפחות שם אחד' };
  if (rows.length > 300) return { ok: false, error: 'עד 300 אורחים בבת אחת' };

  const sb = await supabaseServer();
  const { error } = await sb.from('guests_rsvp').insert(rows);
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את האורחים' };

  touch(clientId);
  return { ok: true, added: rows.length };
}

export async function deleteGuest(form: FormData): Promise<void> {
  const id = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('guests_rsvp').delete().eq('id', id);
  touch(clientId);
}

/** Recording a reply that came in by phone. The guest's own link writes
 *  through the token function instead, which is the only path open to
 *  somebody without an account. */
export async function setGuestStatus(form: FormData): Promise<void> {
  const id = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const status = String(form.get('status') ?? '');
  if (!id || !['pending', 'attending', 'declined'].includes(status)) return;

  const sb = await supabaseServer();
  await sb
    .from('guests_rsvp')
    .update({
      status,
      party_size: status === 'declined' ? 0 : 1,
      responded_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id);
  touch(clientId);
}
