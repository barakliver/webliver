import { site, type SiteCopy } from '../content/site.ts';
import { siteEn } from '../content/site.en.ts';
import { EDITABLE_KEYS } from '../content/editable.ts';
import { DEFAULT_LOCALE, type Locale } from '../lib/locale.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The shipped copy for a language. Both are the same type, so a field added
 *  to one is a compile error until it exists in the other. */
const SHIPPED: Record<Locale, SiteCopy> = { he: site, en: siteEn };

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

export function mergeCopy(
  overrides: { key: string; value: string }[],
  locale: Locale = DEFAULT_LOCALE,
): SiteCopy {
  const base = SHIPPED[locale] ?? site;
  /* The editor writes one sentence per key, in Hebrew, because that is the
     language the person editing works in. Applying those rows to the English
     page would put Hebrew in the middle of it, which is worse than English
     that is one edit behind. So English is the shipped copy until the editor
     learns to hold a sentence per language, and that is a deliberate limit
     rather than an oversight. */
  if (locale !== DEFAULT_LOCALE) return base;
  if (overrides.length === 0) return base;
  const out = clone(base);
  for (const row of overrides) {
    if (EDITABLE_KEYS.has(row.key)) applyAt(out, row.key, row.value);
  }
  return out;
}

/**
 * The overrides, remembered for a few minutes.
 *
 * The page used to be rebuilt on a timer, which meant the database was read
 * once every five minutes however many people visited. Reading the language
 * from a cookie makes the page per-request, and without something here that
 * would quietly turn one query per five minutes into one query per visitor.
 *
 * So the timer moves down a layer. Same effect, same five minutes, and it no
 * longer depends on how the page above it happens to be rendered. An edit still
 * appears immediately, because the editor clears this on its way out.
 */
const TTL = 5 * 60 * 1000;
let cached: { at: number; rows: { key: string; value: string }[] } | null = null;

/** Called by the site editor after a save, so an edit does not wait out the
 *  timer to be seen. */
export function forgetSiteCopy(): void {
  cached = null;
}

/**
 * The copy for the public site.
 *
 * Reads the overrides belonging to whoever the public site is for, which is the
 * same producer the enquiry form files leads under. Any failure falls back to
 * the shipped copy, deliberately without rethrowing: nothing on the marketing
 * page is worth a 500.
 */
export async function getSiteCopy(
  sb: SupabaseClient,
  locale: Locale = DEFAULT_LOCALE,
): Promise<SiteCopy> {
  const base = SHIPPED[locale] ?? site;
  /* Nothing to look up: English has no overrides by design, so it does not pay
     for a round trip on every visit. */
  if (locale !== DEFAULT_LOCALE) return base;

  if (cached && Date.now() - cached.at < TTL) return mergeCopy(cached.rows, locale);

  try {
    const { data: producerId, error: whoError } = await sb.rpc('public_site_producer');
    if (whoError || !producerId) {
      if (whoError) console.error('[site] could not resolve the public producer', whoError);
      return base;
    }

    const { data, error } = await sb
      .from('site_content')
      .select('key,value')
      .eq('producer_id', producerId);

    if (error) {
      console.error('[site] could not read the copy overrides', error);
      return base;
    }
    const rows = (data ?? []) as { key: string; value: string }[];
    /* Only a successful read is remembered. Caching a failure would turn one
       bad minute into five minutes of the wrong page. */
    cached = { at: Date.now(), rows };
    return mergeCopy(rows, locale);
  } catch (e) {
    console.error('[site] copy override lookup threw', e);
    return base;
  }
}
