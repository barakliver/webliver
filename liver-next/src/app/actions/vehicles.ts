'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';

/** The cars: how everybody gets to the hall and home. Every action returns
 *  what happened, for the same reason the envelopes do. */
export type VehicleResult = { ok: boolean; error?: string };

const MISSING = 'חסרים פרטים';
const NO_SESSION = 'צריך להתחבר';
const FAILED = 'לא הצלחנו לשמור. אפשר לנסות שוב.';
const LEGS = new Set(['to', 'from', 'both']);

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

export async function addVehicle(_prev: VehicleResult | null, form: FormData): Promise<VehicleResult> {
  const clientId = String(form.get('client_id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const driver = String(form.get('driver') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim();
  const riders = String(form.get('riders') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  const legRaw = String(form.get('leg') ?? 'both');
  const seatsRaw = String(form.get('seats') ?? '').trim();
  const seats = seatsRaw ? Number(seatsRaw) : null;

  if (!clientId) return { ok: false, error: MISSING };
  if (name.length < 1) return { ok: false, error: 'איך קוראים לרכב?' };
  if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 60)) {
    return { ok: false, error: 'מספר מקומות לא תקין' };
  }
  const leg = LEGS.has(legRaw) ? legRaw : 'both';

  const account = await currentAccount();
  if (!account) return { ok: false, error: NO_SESSION };
  const sb = await supabaseServer();

  const { data: last } = await sb.from('event_vehicles')
    .select('sort').eq('client_id', clientId).order('sort', { ascending: false }).limit(1).maybeSingle();

  const { error } = await sb.from('event_vehicles').insert({
    client_id: clientId,
    name: name.slice(0, 60),
    driver: driver.slice(0, 80),
    phone: phone.slice(0, 30),
    riders: riders.slice(0, 400),
    note: note.slice(0, 400),
    seats,
    leg,
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) {
    console.error('[vehicles] insert failed', error);
    return { ok: false, error: FAILED };
  }
  touch(clientId);
  return { ok: true };
}

export async function removeVehicle(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) { await noteFailure(MISSING); return; }
  const sb = await supabaseServer();
  const { error } = await sb.from('event_vehicles').delete().eq('id', id).eq('client_id', clientId);
  if (error) {
    console.error('[vehicles] delete failed', error);
    await noteFailure('הרכב לא נמחק. אפשר לנסות שוב.');
    return;
  }
  touch(clientId);
}
