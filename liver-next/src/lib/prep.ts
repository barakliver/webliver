import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows, safeValue } from '@/lib/safe';
import type { Vip, Look, Share } from '@/components/app/PrepSheet';

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

export type PrepData = { vips: Vip[]; looks: Look[]; shares: Share[] };

type VipRow = { id: string; client_id: string; name: string; relation: string; note: string; photo_url: string | null };
type LookRow = { id: string; client_id: string; category: Look['category']; note: string; image_url: string | null };
type ShareRow = {
  id: string; client_id: string; token: string; scope: Share['scope']; label: string;
  expires_at: string | null; revoked_at: string | null;
};

const EMPTY: PrepData = { vips: [], looks: [], shares: [] };

/**
 * One event's faces, looks and links — or several events' — ready to render.
 *
 * Written once because it is read from two sides. The producer opens it as a
 * tab on the event file and the couple meets it as a panel in their own area,
 * and they are looking at the same rows: the couple knows who the aunt is, the
 * producer knows what the photographer needs, and a second copy of this
 * loader would be the place the two screens quietly drift apart.
 *
 * Three reads rather than one join, each allowed to fail on its own: a share
 * link that will not load must not take the roster down with it. The pictures
 * are signed in one call for every event on the screen, because the couple's
 * area draws its whole workspace list at once.
 */
export async function loadPrep(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  sb: SupabaseClient<any, any, any>,
  clientIds: string[],
): Promise<Map<string, PrepData>> {
  const byClient = new Map<string, PrepData>();
  if (clientIds.length === 0) return byClient;
  clientIds.forEach((id) => byClient.set(id, { vips: [], looks: [], shares: [] }));

  const [vips, looks, shares] = await Promise.all([
    safeRows<VipRow>('prep faces', sb.from('event_vips')
      .select('id,client_id,name,relation,note,photo_url')
      .in('client_id', clientIds).order('sort').order('created_at')),
    safeRows<LookRow>('prep looks', sb.from('event_looks')
      .select('id,client_id,category,note,image_url')
      .in('client_id', clientIds).order('category').order('sort').order('created_at')),
    safeRows<ShareRow>('prep links', sb.from('event_prep_shares')
      .select('id,client_id,token,scope,label,expires_at,revoked_at')
      .in('client_id', clientIds).is('revoked_at', null).order('created_at', { ascending: false })),
  ]);

  /* The bucket is private, so what a screen gets is signed urls and never
     paths. An hour is longer than anybody spends on this panel. */
  const paths = [...vips.map((v) => v.photo_url), ...looks.map((l) => l.image_url)].filter(Boolean) as string[];
  const urls = await safeValue('prep pictures', signPrepImages(sb, paths), new Map<string, string>());
  const link = (path: string | null) => (path ? urls.get(path) ?? null : null);

  for (const v of vips) {
    byClient.get(v.client_id)?.vips.push({
      id: v.id, name: v.name, relation: v.relation, note: v.note, url: link(v.photo_url),
    });
  }
  for (const l of looks) {
    byClient.get(l.client_id)?.looks.push({
      id: l.id, category: l.category, note: l.note, url: link(l.image_url),
    });
  }
  for (const s of shares) {
    byClient.get(s.client_id)?.shares.push({
      id: s.id, token: s.token, scope: s.scope, label: s.label,
      expiresAt: s.expires_at, revokedAt: s.revoked_at,
    });
  }

  return byClient;
}

/** What one event's panel needs, with the empty shape for an event that has
 *  nothing yet — so a caller never has to decide what a missing key means. */
export const prepOf = (all: Map<string, PrepData>, id: string): PrepData => all.get(id) ?? EMPTY;
