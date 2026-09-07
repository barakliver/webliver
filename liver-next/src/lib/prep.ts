import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Storage paths in, signed urls out.
 *
 * The event's files live in a private bucket and stay there. Making it public
 * so a link can work would be trading somebody's family photographs for a
 * convenience, so the paths are exchanged for urls that expire — an hour,
 * which is longer than anybody spends on the screen and shorter than the life
 * of a screenshot.
 *
 * One call for the whole page rather than one per picture: a roster of twenty
 * faces is twenty round trips to storage otherwise, on a screen that already
 * did three reads.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export async function signPrepImages(sb: SupabaseClient<any, any, any>, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(paths.filter(Boolean))];
  if (wanted.length === 0) return out;

  const { data, error } = await sb.storage.from('files').createSignedUrls(wanted, 60 * 60);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
