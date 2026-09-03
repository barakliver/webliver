'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { fileAllowed, isMediaTag, MAX_FILE_BYTES } from '@/lib/fileTypes';

export type FileResult = { ok: boolean; error?: string };

const BUCKET = 'files';

const refresh = (clientId: string) => {
  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${clientId}`);
};

/**
 * The row for a file the browser has already put in the bucket.
 *
 * The bytes never pass through this server. A server action is a request body,
 * and a request body has a limit measured in single megabytes — a photograph
 * off a phone is already past it, and a video is nowhere near. So the browser
 * uploads straight to storage under its own session, where the same row level
 * policies decide whether it may, and this records what landed.
 *
 * Which means the path arriving here is attacker controlled, and is checked
 * rather than trusted: it must sit in this workspace's own folder. Storage
 * would have refused an upload anywhere else, but a row is not an upload —
 * without this check somebody could file a row pointing at another event's
 * object and read it back through their own screen.
 */
export async function registerFile(input: {
  clientId: string; path: string; name: string; mime: string; size: number; note?: string; tag?: string;
}): Promise<FileResult> {
  const { clientId, path, mime } = input;
  const name = String(input.name ?? '').trim().slice(0, 200);
  const note = String(input.note ?? '').trim().slice(0, 300);
  const size = Number(input.size) || 0;
  /* An unknown tag is no tag, not a refusal: the picture matters more than
     the word on it, and the word can be changed from the grid. */
  const tag = isMediaTag(String(input.tag ?? '')) ? String(input.tag) : '';

  if (!clientId || !path || !name) return { ok: false, error: 'חסרים פרטים על הקובץ' };
  if (!path.startsWith(`${clientId}/`) || path.includes('..')) {
    return { ok: false, error: 'הקובץ לא נשמר במקום הנכון' };
  }
  if (size > MAX_FILE_BYTES) return { ok: false, error: 'הקובץ גדול מדי. עד 50MB.' };
  if (!fileAllowed(mime)) return { ok: false, error: 'סוג הקובץ הזה לא נתמך' };

  const sb = await supabaseServer();
  const { data: me } = await sb.auth.getUser();
  const uid = me.user?.id;
  if (!uid) return { ok: false, error: 'צריך להתחבר' };

  const { error } = await sb.from('client_files').insert({
    client_id: clientId, uploaded_by: uid, name, path, mime, size_bytes: size, note, tag,
  });

  /* A file in the bucket with no row is a file nobody can see or remove, so it
     goes with the failed row rather than sitting there forever. */
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    return { ok: false, error: 'לא הצלחנו לשמור את הקובץ' };
  }

  refresh(clientId);
  return { ok: true };
}

export async function deleteFile(form: FormData): Promise<void> {
  const id = String(form.get('file_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { data: row } = await sb.from('client_files').select('path').eq('id', id).maybeSingle();

  const { error } = await sb.from('client_files').delete().eq('id', id);
  /* Only clear the object once the row is actually gone, so a refused delete
     cannot strand a row pointing at nothing. */
  if (!error && row?.path) await sb.storage.from(BUCKET).remove([row.path]);

  refresh(clientId);
}

/** The note is the only thing worth changing after the fact — a database
 *  trigger keeps the rest, so this cannot quietly rewrite where a file came
 *  from even if a future screen sends more than it should. */
export async function noteFile(form: FormData): Promise<void> {
  const id = String(form.get('file_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const note = String(form.get('note') ?? '').trim().slice(0, 300);
  if (!id) return;

  const sb = await supabaseServer();
  await sb.from('client_files').update({ note }).eq('id', id);
  refresh(clientId);
}

/** The tag moves as freely as the note, and for the same reason: which of
 *  the four words a picture belongs under is a thing people get wrong on the
 *  way in and right on the way past. */
export async function tagFile(input: { fileId: string; clientId: string; tag: string }): Promise<FileResult> {
  const { fileId, clientId } = input;
  if (!fileId) return { ok: false, error: 'חסר מזהה קובץ' };
  const tag = isMediaTag(input.tag) ? input.tag : '';

  const sb = await supabaseServer();
  const { error } = await sb.from('client_files').update({ tag }).eq('id', fileId);
  if (error) {
    console.error('[files] retag failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את התיוג' };
  }
  refresh(clientId);
  return { ok: true };
}
