import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventFile } from '@/components/app/EventFiles';

type Row = {
  id: string; client_id: string; name: string; note: string;
  mime: string; size_bytes: number; created_at: string;
  uploaded_by: string | null; path: string;
};

const COLS = 'id,client_id,name,note,mime,size_bytes,created_at,uploaded_by,path';

/**
 * The shared folder for one or more events, ready to render.
 *
 * The bucket is private, so every row needs a signed link — one call for the
 * whole page rather than one per file, the same way the moodboard does it.
 *
 * Names come from thread_people() rather than profiles, for the same reason
 * the thread does: profiles is self-read only, so reading it here would sign
 * every file the producer sent "·" on the couple's screen. The function hands
 * back a display name for the people on a workspace the caller can already
 * read, and nothing else about them.
 */
export async function loadFiles(
  sb: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, EventFile[]>> {
  const byClient = new Map<string, EventFile[]>();
  if (clientIds.length === 0) return byClient;

  const { data } = await sb
    .from('client_files')
    .select(COLS)
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })
    .limit(400);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    clientIds.forEach((id) => byClient.set(id, []));
    return byClient;
  }

  const [urls, who] = await Promise.all([
    (async () => {
      const { data: signed } = await sb.storage
        .from('files')
        .createSignedUrls(rows.map((r) => r.path), 60 * 60);
      const map = new Map<string, string>();
      (signed ?? []).forEach((s) => {
        if (s.signedUrl && s.path) map.set(s.path, s.signedUrl);
      });
      return map;
    })(),
    (async () => {
      const names = new Map<string, string>();
      await Promise.all(
        clientIds.map(async (cid) => {
          const { data: people } = await sb.rpc('thread_people', { p_client: cid });
          (people ?? []).forEach((p: { id: string; display_name: string }) => {
            if (!names.has(p.id)) names.set(p.id, p.display_name || '·');
          });
        })
      );
      return names;
    })(),
  ]);

  clientIds.forEach((id) => byClient.set(id, []));

  for (const r of rows) {
    /* A row whose object has gone missing is skipped rather than rendered as a
       link that opens nothing. */
    const url = urls.get(r.path);
    if (!url) continue;
    const list = byClient.get(r.client_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      note: r.note,
      mime: r.mime,
      size_bytes: Number(r.size_bytes) || 0,
      created_at: r.created_at,
      uploader: r.uploaded_by ? (who.get(r.uploaded_by) ?? '·') : '·',
      mine: false,
      url,
    });
    byClient.set(r.client_id, list);
  }

  /* Who may remove a row is a policy question, and the honest answer is the
     one the database gives. Marking it here lets the screen hide a button it
     knows would be refused, without the button being the only thing standing
     between anybody and somebody else's file. */
  const { data: me } = await sb.auth.getUser();
  const uid = me.user?.id ?? null;
  if (uid) {
    const owned = new Set(rows.filter((r) => r.uploaded_by === uid).map((r) => r.id));
    byClient.forEach((list) =>
      list.forEach((f) => {
        f.mine = owned.has(f.id);
      })
    );
  }

  return byClient;
}
