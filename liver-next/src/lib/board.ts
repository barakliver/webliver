import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardImage } from '@/components/app/WinningBoard';

type Row = { id: string; client_id: string; category: string; caption: string; image_path: string };

/** The bucket is private, so every image needs a short lived signed link.
 *  One call for the whole page rather than one per photo. */
export async function signBoardImages(
  sb: SupabaseClient,
  rows: Row[]
): Promise<(BoardImage & { client_id: string })[]> {
  if (rows.length === 0) return [];

  const { data } = await sb.storage
    .from('moodboards')
    .createSignedUrls(rows.map((r) => r.image_path), 60 * 60);

  const byPath = new Map<string, string>();
  (data ?? []).forEach((d) => {
    if (d.signedUrl && d.path) byPath.set(d.path, d.signedUrl);
  });

  /* A row whose file has gone missing is skipped rather than rendered as a
     broken frame the couple cannot explain or remove. */
  return rows
    .filter((r) => byPath.has(r.image_path))
    .map((r) => ({
      id: r.id,
      client_id: r.client_id,
      category: r.category,
      caption: r.caption,
      url: byPath.get(r.image_path)!,
    }));
}
