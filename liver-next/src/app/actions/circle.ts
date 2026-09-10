'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { isCategory } from '@/content/critique';

export type CircleResult = { ok: boolean; error?: string };

const touch = (postId?: string) => {
  revalidatePath('/app/portal/community');
  if (postId) revalidatePath(`/app/portal/community/${postId}`);
};

/** A question to the circle.
 *
 *  `author_id` is written as the signed-in account and the row policy
 *  checks it against `auth.uid()`, so a post cannot be filed in somebody
 *  else's name. Whether it carries the producer's badge is decided by a
 *  trigger from the author's real role rather than by anything here. */
export async function addCirclePost(_prev: CircleResult | null, form: FormData): Promise<CircleResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const producerId = String(form.get('producer_id') ?? '');
  const clientId = String(form.get('client_id') ?? '') || null;
  const categoryRaw = String(form.get('category') ?? 'general');
  const title = String(form.get('title') ?? '').trim().slice(0, 140);
  const content = String(form.get('content') ?? '').trim().slice(0, 6000);
  const anonymous = String(form.get('is_anonymous') ?? '') === 'on';

  if (!producerId) return { ok: false, error: 'המעגל לא זמין כאן' };
  if (title.length < 2) return { ok: false, error: 'חסרה כותרת' };
  if (content.length < 2) return { ok: false, error: 'חסר תוכן' };

  const sb = await supabaseServer();
  const { error } = await sb.from('forum_posts').insert({
    producer_id: producerId, author_id: account.id, client_id: clientId,
    is_anonymous: anonymous, category: isCategory(categoryRaw) ? categoryRaw : 'general',
    title, content,
  });
  if (error) {
    console.error('[circle] post failed', error);
    return { ok: false, error: 'לא הצלחנו לפרסם. אפשר לנסות שוב.' };
  }
  touch();
  return { ok: true };
}

export async function addCircleReply(_prev: CircleResult | null, form: FormData): Promise<CircleResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const postId = String(form.get('post_id') ?? '');
  const clientId = String(form.get('client_id') ?? '') || null;
  const content = String(form.get('content') ?? '').trim().slice(0, 4000);
  const anonymous = String(form.get('is_anonymous') ?? '') === 'on';
  if (!postId || !content) return { ok: false, error: 'אין מה לשלוח' };

  const sb = await supabaseServer();
  const { error } = await sb.from('forum_comments').insert({
    post_id: postId, author_id: account.id, client_id: clientId,
    is_anonymous: anonymous, content,
  });
  if (error) {
    console.error('[circle] reply failed', error);
    return { ok: false, error: 'לא הצלחנו לשלוח. אפשר לנסות שוב.' };
  }
  touch(postId);
  return { ok: true };
}

/** One vote per person per post, so pressing again takes it back. */
export async function toggleCircleVote(form: FormData): Promise<void> {
  const account = await currentAccount();
  const postId = String(form.get('post_id') ?? '');
  const on = String(form.get('on') ?? '') === 'true';
  if (!account || !postId) return;

  const sb = await supabaseServer();
  const { error } = on
    ? await sb.from('forum_votes').insert({ post_id: postId, profile_id: account.id })
    : await sb.from('forum_votes').delete().eq('post_id', postId).eq('profile_id', account.id);
  /* A duplicate is the button pressed twice, not a failure worth a banner. */
  if (error && error.code !== '23505') {
    console.error('[circle] vote failed', error);
    await noteFailure('לא הצלחנו לשמור את הסימון.');
  }
  touch(postId);
}

export async function deleteCirclePost(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('forum_posts').delete().eq('id', id);
  if (error) {
    console.error('[circle] delete failed', error);
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  }
  touch();
}

export async function deleteCircleReply(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const postId = String(form.get('post_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('forum_comments').delete().eq('id', id);
  if (error) {
    console.error('[circle] reply delete failed', error);
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  }
  touch(postId);
}
