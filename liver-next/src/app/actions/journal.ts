'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
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
