import { site, type SiteCopy } from '../content/site.ts';
import { EDITABLE_KEYS } from '../content/editable.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The public copy, with any edits applied.
 *
 * The shipped text is the default and the fallback. If the override table is
 * empty the site reads exactly as it does today; if the database is
 * unreachable the worst case is a visitor reading last month's wording rather
 * than a blank homepage. That ordering is the whole design: a marketing site
 * that can be taken down by a database is a marketing site with a new way to
 * fail that it did not have before.
 *
 * Only keys the editor offers are applied. A row for anything else is ignored
 * rather than merged, so a stale key left behind by a rename cannot quietly
 * write into a shape nothing expects.
 */

/** A structural copy, so an override never mutates the module's own object.
 *  The shipped copy is imported once per process and shared by every request;
 *  writing into it would leak one visitor's producer copy to the next. */
function clone(copy: SiteCopy): SiteCopy {
  return JSON.parse(JSON.stringify(copy)) as SiteCopy;
}

function applyAt(target: SiteCopy, key: string, value: string): void {
  const parts = key.split('.');
  const last = parts.pop();
  if (!last) return;

  let node: Record<string, unknown> = target as unknown as Record<string, unknown>;
  for (const part of parts) {
    const next = node[part];
    if (!next || typeof next !== 'object') return;
    node = next as Record<string, unknown>;
  }

  const current = node[last];
  /* The shape of the default decides the shape of the override. A list stays a
     list and a sentence stays a sentence, whatever happens to be in the text
     column, so no edit can hand a component the wrong kind of thing. */
  if (Array.isArray(current)) {
    node[last] = value.split('\n').map((l) => l.trim()).filter(Boolean);
  } else if (typeof current === 'string') {
    node[last] = value;
  }
}

export function mergeCopy(overrides: { key: string; value: string }[]): SiteCopy {
  if (overrides.length === 0) return site;
  const out = clone(site);
  for (const row of overrides) {
    if (EDITABLE_KEYS.has(row.key)) applyAt(out, row.key, row.value);
  }
  return out;
}

/**
 * The copy for the public site.
 *
 * Reads the overrides belonging to whoever the public site is for, which is the
 * same producer the enquiry form files leads under. Any failure falls back to
 * the shipped copy, deliberately without rethrowing: nothing on the marketing
 * page is worth a 500.
 */
export async function getSiteCopy(sb: SupabaseClient): Promise<SiteCopy> {
  try {
    const { data: producerId, error: whoError } = await sb.rpc('public_site_producer');
    if (whoError || !producerId) {
      if (whoError) console.error('[site] could not resolve the public producer', whoError);
      return site;
    }

    const { data, error } = await sb
      .from('site_content')
      .select('key,value')
      .eq('producer_id', producerId);

    if (error) {
      console.error('[site] could not read the copy overrides', error);
      return site;
    }
    return mergeCopy((data ?? []) as { key: string; value: string }[]);
  } catch (e) {
    console.error('[site] copy override lookup threw', e);
    return site;
  }
}
