'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { MUSIC_MOMENTS, EQUIPMENT_CHECK, COUPLE_DETAIL_FIELDS } from '@/content/eventFile';

export type FileResult = { ok: boolean; error?: string };

const refresh = (clientId: string) => {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
};

/**
 * The three lists from his own file.
 *
 * Every write here is an upsert keyed on the natural key — event plus moment,
 * event plus item, event plus person — because these are fixed lists rendered
 * from shipped content rather than rows somebody adds. A screen showing seven
 * moments should not have to know whether a given one has a row yet, and
 * inserting on first keystroke and updating after would put that knowledge in
 * every component that touches it.
 *
 * The name of the moment, the item and the field are checked against the
 * shipped list rather than trusted. They arrive from a browser, and a row
 * under a moment nothing renders is a row nobody will ever see or delete.
 */

export async function saveSong(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const moment = String(form.get('moment') ?? '');
  if (!clientId || !MUSIC_MOMENTS.includes(moment)) return;

  const sb = await supabaseServer();
  await sb.from('event_music').upsert(
    {
      client_id: clientId,
      moment,
      song: String(form.get('song') ?? '').trim().slice(0, 200),
      artist: String(form.get('artist') ?? '').trim().slice(0, 160),
      note: String(form.get('note') ?? '').trim().slice(0, 500),
    },
    { onConflict: 'client_id,moment' }
  );

  refresh(clientId);
}

export async function setEquipment(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const item = String(form.get('item') ?? '');
  if (!clientId || !EQUIPMENT_CHECK.includes(item)) return;

  /* Three states rather than a tick: not needed, needed, sorted. A checkbox
     cannot say "we need a generator and have not booked one", which is the
     only state on this list worth being reminded of. */
  const state = String(form.get('state') ?? '');
  const needed = state === 'needed' || state === 'sorted';
  const sorted = state === 'sorted';

  const sb = await supabaseServer();
  await sb.from('event_equipment').upsert(
    { client_id: clientId, item, needed, sorted },
    { onConflict: 'client_id,item' }
  );

  refresh(clientId);
}

export async function saveCouple(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const person = String(form.get('person') ?? '');
  if (!clientId || (person !== 'a' && person !== 'b')) return;

  const fields: Record<string, string> = {};
  for (const key of COUPLE_DETAIL_FIELDS) {
    const v = String(form.get(`f:${key}`) ?? '').trim().slice(0, 600);
    if (v) fields[key] = v;
  }

  const sb = await supabaseServer();
  await sb.from('couple_details').upsert(
    {
      client_id: clientId,
      person,
      name: String(form.get('name') ?? '').trim().slice(0, 120),
      fields,
    },
    { onConflict: 'client_id,person' }
  );

  refresh(clientId);
}
