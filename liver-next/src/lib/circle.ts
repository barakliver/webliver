import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from '@/lib/auth';
import { safeRows, safeValue } from '@/lib/safe';
import type { CritiqueLog } from '@/content/critique';

/**
 * The two rooms a couple shares with somebody: their own journal, and the
 * circle around their producer.
 *
 * Both start from the same question, "which producer is this account
 * inside", because the circle stops at that boundary and the journal hangs
 * off a workspace under it. A producer answers it from their own row; a
 * couple answers it from the workspace they were invited to.
 */

export type CircleWho = {
  producerId: string | null;
  /** The couple's workspace, or the one named in the address. Null for a
   *  producer, who posts as themselves rather than as an event. */
  clientId: string | null;
  eventName: string;
};

export async function whoAmI(sb: SupabaseClient, account: Account, wanted?: string): Promise<CircleWho> {
  if (account.producer) return { producerId: account.producer.id, clientId: null, eventName: '' };
  const rows = await safeRows<{ id: string; producer_id: string; display_name: string }>('circle workspace',
    sb.from('clients').select('id,producer_id,display_name').is('archived_at', null).order('event_date', { ascending: true, nullsFirst: false }));
  const row = rows.find((r) => r.id === wanted) ?? rows[0] ?? null;
  return row
    ? { producerId: row.producer_id, clientId: row.id, eventName: row.display_name }
    : { producerId: null, clientId: null, eventName: '' };
}

/* ── the journal ─────────────────────────────────────────────────────────── */

export type JournalLog = CritiqueLog & { photoUrls: string[] };

export async function loadJournal(sb: SupabaseClient, clientId: string): Promise<JournalLog[]> {
  const rows = await safeRows<CritiqueLog & { photos: string[] }>('journal', sb.from('event_critique_logs')
    .select('id,venue_name,event_date,style,pros,cons,pros_note,cons_note,takeaways,photos')
    .eq('client_id', clientId)
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }));

  /* One signing call for the whole screen rather than one per photograph. */
  const paths = rows.flatMap((r) => r.photos ?? []);
  const byPath = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await safeValue('journal photos', sb.storage.from('files').createSignedUrls(paths, 60 * 60), { data: [] } as never);
    for (const d of (signed as { data?: { path?: string | null; signedUrl?: string | null }[] }).data ?? []) {
      if (d.path && d.signedUrl) byPath.set(d.path, d.signedUrl);
    }
  }
  return rows.map((r) => ({ ...r, photoUrls: (r.photos ?? []).map((p) => byPath.get(p)).filter((u): u is string => !!u) }));
}

/* ── the circle ──────────────────────────────────────────────────────────── */

export type CirclePost = {
  id: string; category: string; title: string; content: string; upvotes: number;
  created_at: string; is_anonymous: boolean; is_producer: boolean;
  author_name: string; months_out: number | null; mine: boolean; voted: boolean; replies: number;
};

export type CircleReply = {
  id: string; content: string; created_at: string;
  is_anonymous: boolean; is_producer: boolean; author_name: string; months_out: number | null; mine: boolean;
};

export async function loadFeed(sb: SupabaseClient, producerId: string, category = ''): Promise<CirclePost[]> {
  return safeValue<CirclePost[]>('circle feed', (async () => {
    const { data, error } = await sb.rpc('forum_feed', { p_producer: producerId, p_category: category, p_limit: 60 });
    if (error) throw error;
    return (data ?? []) as CirclePost[];
  })(), []);
}

/** One post by id, however old. The feed stops at the newest few dozen,
 *  and looking through it was how the sixty-first post became "not found". */
export async function loadPost(sb: SupabaseClient, postId: string): Promise<CirclePost | null> {
  return safeValue<CirclePost | null>('circle post', (async () => {
    const { data, error } = await sb.rpc('forum_post', { p_post: postId });
    if (error) throw error;
    const rows = (data ?? []) as CirclePost[];
    return rows[0] ?? null;
  })(), null);
}

export async function loadThread(sb: SupabaseClient, postId: string): Promise<CircleReply[]> {
  return safeValue<CircleReply[]>('circle thread', (async () => {
    const { data, error } = await sb.rpc('forum_thread', { p_post: postId });
    if (error) throw error;
    return (data ?? []) as CircleReply[];
  })(), []);
}
