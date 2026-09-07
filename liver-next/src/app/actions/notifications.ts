'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

/** Nobody writes their own notifications — the database triggers do — so the
 *  only thing these actions can change is whether you have read one. */
export async function markRead(form: FormData): Promise<void> {
  const id = String(form.get('notice_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    /* Logged, not announced. This fires on its own when a screen opens rather
       than because somebody pressed anything, and a red line about a read
       receipt is a worse screen than a receipt that quietly did not stick. */
    console.error('[notifications] markRead failed', error);
  }
  revalidatePath('/app', 'layout');
}

export async function markAllRead(): Promise<void> {
  const sb = await supabaseServer();
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) {
    /* Logged, not announced. This fires on its own when a screen opens rather
       than because somebody pressed anything, and a red line about a read
       receipt is a worse screen than a receipt that quietly did not stick. */
    console.error('[notifications] markAllRead failed', error);
  }
  revalidatePath('/app', 'layout');
}
