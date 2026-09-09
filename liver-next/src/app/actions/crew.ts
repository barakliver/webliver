'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type CrewResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
}

/** A fee, or nothing. Nothing is a real answer: half the crew on an evening are
 *  on a day rate agreed by message and not written anywhere yet, and a form
 *  that insists on a number is a form somebody skips. */
function readFee(form: FormData): number | null {
  const raw = String(form.get('fee') ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function fields(form: FormData) {
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 2) return 'נא למלא שם';

  const time = String(form.get('call_time') ?? '').trim();
  return {
    name: name.slice(0, 120),
    role: String(form.get('role') ?? '').trim().slice(0, 80),
    phone: String(form.get('phone') ?? '').trim().slice(0, 40),
    call_time: /^\d{2}:\d{2}$/.test(time) ? time : null,
    fee: readFee(form),
    notes: String(form.get('notes') ?? '').trim().slice(0, 500),
  };
}

export async function addCrew(_prev: CrewResult | null, form: FormData): Promise<CrewResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const f = fields(form);
  if (typeof f === 'string') return { ok: false, error: f };

  const sb = await supabaseServer();
  const { error } = await sb.from('crew').insert({ client_id: clientId, ...f });
  if (error) {
    console.error('[crew] insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }
  touch(clientId);
  return { ok: true };
}

export async function updateCrew(_prev: CrewResult | null, form: FormData): Promise<CrewResult> {
  const id = String(form.get('crew_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה' };

  const f = fields(form);
  if (typeof f === 'string') return { ok: false, error: f };

  const sb = await supabaseServer();
  const { error } = await sb.from('crew').update(f).eq('id', id);
  if (error) {
    console.error('[crew] update failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את השינוי' };
  }
  touch(clientId);
  return { ok: true };
}

export async function removeCrew(form: FormData): Promise<void> {
  const id = String(form.get('crew_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('crew').delete().eq('id', id);
  touch(clientId);
}
