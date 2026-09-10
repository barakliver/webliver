'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { BOARD_CATEGORIES } from '@/content/lists';

export type BoardResult = { ok: boolean; error?: string };

const BUCKET = 'moodboards';

/**
 * The row for a photograph the browser has already put in the bucket.
 *
 * The board used to send the bytes through a server action, one file per
 * press, and a server action has a ceiling of a few megabytes. One photograph off
 * a camera is past it, and eight together are far past it, and the
 * ceiling is a 413 that the screen never hears about. So the board now
 * does what the shared folder does: the browser uploads under its own
 * session, straight to storage, where the same policies decide whether
 * it may, and this records what landed.
 *
 * The path is attacker controlled and is checked rather than trusted: it
 * must sit in this workspace's own folder, or a row could be filed
 * pointing at another couple's photograph.
 */
export async function registerBoardImage(input: {
  clientId: string; path: string; caption?: string; category?: string;
}): Promise<BoardResult> {
  const { clientId, path } = input;
  const caption = String(input.caption ?? '').trim().slice(0, 200);
  const categoryRaw = String(input.category ?? 'other');
  const category = BOARD_CATEGORIES.some((c) => c.value === categoryRaw) ? categoryRaw : 'other';

  if (!clientId || !path) return { ok: false, error: 'חסרים פרטים על התמונה' };
  if (!path.startsWith(`${clientId}/`) || path.includes('..')) {
    return { ok: false, error: 'התמונה לא נשמרה במקום הנכון' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('moodboards').insert({ client_id: clientId, category, caption, image_path: path });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    return { ok: false, error: 'לא הצלחנו לשמור את התמונה' };
  }

  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath(`/app/clients/${clientId}/preview`);
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
