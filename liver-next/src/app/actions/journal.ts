'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure, noteDone } from '@/lib/flash';
import { isProTag, isConTag, isStyle } from '@/content/critique';

export type JournalResult = { ok: boolean; error?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A wedding they went to, written down.
 *
 *  The tags are checked against the shipped lists rather than stored as
 *  typed: a key nobody has a label for is a chip that renders as its own
 *  identifier on the summary screen. The photographs are paths the browser
 *  has already uploaded under this workspace's folder, and are checked to
 *  be exactly that, because a path is caller-controlled and a row pointing
 *  at another workspace's object is a way to read it. */
export async function saveCritiqueLog(_prev: JournalResult | null, form: FormData): Promise<JournalResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const clientId = String(form.get('client_id') ?? '');
  const venue = String(form.get('venue_name') ?? '').trim().slice(0, 120);
  const date = String(form.get('event_date') ?? '');
  const styleRaw = String(form.get('style') ?? '');
  const pros = form.getAll('pros').map(String).filter(isProTag).slice(0, 30);
  const cons = form.getAll('cons').map(String).filter(isConTag).slice(0, 30);
  const prosNote = String(form.get('pros_note') ?? '').trim().slice(0, 2000);
  const consNote = String(form.get('cons_note') ?? '').trim().slice(0, 2000);
  const takeaways = String(form.get('takeaways') ?? '').trim().slice(0, 4000);
  const photos = form.getAll('photos').map(String)
    .filter((p) => p.startsWith(`${clientId}/`) && !p.includes('..')).slice(0, 20);

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (!venue && !takeaways && pros.length === 0 && cons.length === 0) {
    return { ok: false, error: 'אין מה לשמור עדיין. אפשר להתחיל משם המקום.' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('event_critique_logs').insert({
    client_id: clientId, venue_name: venue,
    event_date: DATE.test(date) ? date : null,
    style: isStyle(styleRaw) ? styleRaw : '',
    pros, cons, pros_note: prosNote, cons_note: consNote, takeaways, photos,
    created_by: account.id,
  });
  if (error) {
    console.error('[journal] insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור. אפשר לנסות שוב.' };
  }
  await noteDone('החתונה נרשמה ביומן.');
  revalidatePath('/app/portal/journal');
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

/**
 * Correcting a wedding already written down.
 *
 * This table had a save and a delete and nothing between them, and the
 * delete takes every photograph with it — up to twenty, uploaded one at a
 * time from a phone. So a venue name typed from memory in a car at midnight,
 * or a takeaway somebody thought of the next morning, cost the whole entry
 * and all of its pictures. A notebook you cannot write a second line in is
 * not a notebook.
 *
 * The photographs are appended rather than replaced, and that is the reason
 * this reads the row first. The screen only ever holds signed URLs, never
 * the paths behind them, so a form that submitted "the photographs" would be
 * submitting whichever ones were uploaded in this sitting and silently
 * dropping the rest. Reading the stored paths and adding to them is the only
 * version where editing the words cannot cost a picture.
 *
 * `created_by` is never rewritten: it says who wrote this, not who last
 * touched it.
 */
export async function updateCritiqueLog(_prev: JournalResult | null, form: FormData): Promise<JournalResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const venue = String(form.get('venue_name') ?? '').trim().slice(0, 120);
  const date = String(form.get('event_date') ?? '');
  const styleRaw = String(form.get('style') ?? '');
  const pros = form.getAll('pros').map(String).filter(isProTag).slice(0, 30);
  const cons = form.getAll('cons').map(String).filter(isConTag).slice(0, 30);
  const prosNote = String(form.get('pros_note') ?? '').trim().slice(0, 2000);
  const consNote = String(form.get('cons_note') ?? '').trim().slice(0, 2000);
  const takeaways = String(form.get('takeaways') ?? '').trim().slice(0, 4000);
  const added = form.getAll('photos').map(String)
    .filter((p) => p.startsWith(`${clientId}/`) && !p.includes('..'));

  if (!id || !clientId) return { ok: false, error: 'חסר מזהה' };
  if (!venue && !takeaways && pros.length === 0 && cons.length === 0) {
    return { ok: false, error: 'אין מה לשמור עדיין. אפשר להתחיל משם המקום.' };
  }

  const sb = await supabaseServer();
  const { data: row } = await sb.from('event_critique_logs')
    .select('photos').eq('id', id).eq('client_id', clientId).maybeSingle();
  /* Not found under this event is a refusal, not an empty list of pictures
     to write over the real one. */
  if (!row) return { ok: false, error: 'הרשומה לא נמצאה' };

  const kept = (row.photos as string[] | null) ?? [];
  const photos = [...kept, ...added.filter((p) => !kept.includes(p))].slice(0, 20);

  const { data, error } = await sb.from('event_critique_logs')
    .update({
      venue_name: venue,
      event_date: DATE.test(date) ? date : null,
      style: isStyle(styleRaw) ? styleRaw : '',
      pros, cons, pros_note: prosNote, cons_note: consNote, takeaways, photos,
    })
    .eq('id', id).eq('client_id', clientId)
    .select('id');

  if (error) {
    console.error('[journal] update failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור. אפשר לנסות שוב.' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'לא הצלחנו לשמור. אפשר לנסות שוב.' };

  await noteDone('הרשומה עודכנה.');
  revalidatePath('/app/portal/journal');
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

export async function deleteCritiqueLog(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { data: row } = await sb.from('event_critique_logs').select('photos').eq('id', id).maybeSingle();
  const { error } = await sb.from('event_critique_logs').delete().eq('id', id);
  if (error) {
    console.error('[journal] delete failed', error);
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  } else if (row?.photos?.length) {
    /* Only once the row is gone, so a refused delete cannot strand a
       photograph nobody can reach or remove. */
    await sb.storage.from('files').remove(row.photos as string[]);
  }
  revalidatePath('/app/portal/journal');
}
