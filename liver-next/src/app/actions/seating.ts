'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type SeatResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

/** The seating rules live in the database, so these read its complaint and
 *  say it in Hebrew rather than deciding anything themselves. */
function readable(message: string): string {
  const over = message.match(/the table seats (\d+), and (\d+) would be seated/);
  if (over) return `בשולחן יש ${over[1]} מקומות, והושבה כזאת תביא ל-${over[2]}`;
  const shrink = message.match(/(\d+) people are already seated here, so it cannot go down to (\d+)/);
  if (shrink) return `כבר יושבים כאן ${shrink[1]} אנשים, אז אי אפשר לרדת ל-${shrink[2]}`;
  if (/does not exist/.test(message)) return 'השולחן לא נמצא';
  if (/row-level security/.test(message)) return 'אין לך הרשאה לפעולה הזאת';
  return 'הפעולה נכשלה';
}

export async function addTable(_prev: SeatResult | null, form: FormData): Promise<SeatResult> {
  const clientId = String(form.get('client_id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const seats = Number(String(form.get('seats') ?? '12'));

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (name.length < 1) return { ok: false, error: 'נא לתת שם לשולחן' };
  if (!Number.isFinite(seats) || seats < 1 || seats > 40) {
    return { ok: false, error: 'מספר המקומות צריך להיות בין 1 ל-40' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('tables_seating').insert({
    client_id: clientId, name, seats: Math.round(seats),
  });
  if (error) return { ok: false, error: readable(error.message) };

  touch(clientId);
  return { ok: true };
}

export async function setTableSeats(_prev: SeatResult | null, form: FormData): Promise<SeatResult> {
  const id = String(form.get('table_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const seats = Number(String(form.get('seats') ?? ''));
  if (!id) return { ok: false, error: 'חסר מזהה שולחן' };
  if (!Number.isFinite(seats) || seats < 1 || seats > 40) {
    return { ok: false, error: 'מספר המקומות צריך להיות בין 1 ל-40' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('tables_seating').update({ seats: Math.round(seats) }).eq('id', id);
  if (error) return { ok: false, error: readable(error.message) };

  touch(clientId);
  return { ok: true };
}

/** Removing a table leaves its guests unseated rather than deleting them:
 *  the schema sets table_id to null on delete, so nobody vanishes with it. */
export async function deleteTable(form: FormData): Promise<void> {
  const id = String(form.get('table_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('tables_seating').delete().eq('id', id);
  touch(clientId);
}

export async function seatGuest(_prev: SeatResult | null, form: FormData): Promise<SeatResult> {
  const guestId = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const tableRaw = String(form.get('table_id') ?? '');
  const tableId = tableRaw === '' ? null : tableRaw;
  if (!guestId) return { ok: false, error: 'חסר מזהה אורח' };

  const sb = await supabaseServer();
  const { error } = await sb.from('guests_rsvp').update({ table_id: tableId }).eq('id', guestId);
  if (error) return { ok: false, error: readable(error.message) };

  touch(clientId);
  return { ok: true };
}
