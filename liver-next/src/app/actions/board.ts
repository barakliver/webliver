'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { BOARD_CATEGORIES } from '@/content/lists';

export type BoardResult = { ok: boolean; error?: string };

const BUCKET = 'moodboards';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];


function extensionFor(type: string, name: string): string {
  const fromName = (name.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1] ?? '').toLowerCase();
  if (fromName) return fromName;
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

/** The file goes under <client_id>/… because that first path segment is what
 *  the storage policies read to decide who may touch it. A path built any
 *  other way would be refused rather than land somewhere unprotected. */
export async function uploadBoardImage(_prev: BoardResult | null, form: FormData): Promise<BoardResult> {
  const clientId = String(form.get('client_id') ?? '');
  const caption = String(form.get('caption') ?? '').trim();
  const categoryRaw = String(form.get('category') ?? 'other');
  const category = BOARD_CATEGORIES.some((c) => c.value === categoryRaw) ? categoryRaw : 'other';
  const file = form.get('image');

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'נא לבחור תמונה' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'התמונה גדולה מדי. עד 8MB.' };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: 'אפשר להעלות תמונות בלבד' };

  const sb = await supabaseServer();
  const path = `${clientId}/${crypto.randomUUID()}.${extensionFor(file.type, file.name)}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { ok: false, error: 'ההעלאה נכשלה. נסו שוב.' };

  const { error: rowErr } = await sb
    .from('moodboards')
    .insert({ client_id: clientId, category, caption, image_path: path });

  /* A row that never landed would leave an image nobody can reach or remove,
     so the file goes with it. */
  if (rowErr) {
    await sb.storage.from(BUCKET).remove([path]);
    return { ok: false, error: 'לא הצלחנו לשמור את התמונה' };
  }

  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

export async function deleteBoardImage(form: FormData): Promise<void> {
  const id = String(form.get('image_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { data: row } = await sb.from('moodboards').select('image_path').eq('id', id).maybeSingle();

  const { error } = await sb.from('moodboards').delete().eq('id', id);
  /* Only clear the file once the row is actually gone, so a refused delete
     cannot strand a board entry pointing at nothing. */
  if (!error && row?.image_path) {
    await sb.storage.from(BUCKET).remove([row.image_path]);
  }

  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${clientId}`);
}
