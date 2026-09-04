import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Where a product photograph is served from.
 *
 * The store bucket is public, unlike every other bucket in this system, and
 * that is the point: this is a picture of something for sale on a page anybody
 * may read. A signed link would expire in the middle of somebody browsing the
 * shop, and there is nothing here to protect.
 *
 * Built from the project URL rather than stored per row, so a row holds a path
 * and moving the project does not rewrite every product.
 */
export const storeImageBase = (): string =>
  `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')}/storage/v1/object/public/store`;

/** One product's photograph, as a URL. Built in one place so the join lives
 *  somewhere it can be read, rather than in every screen that draws a tile. */
export const storeImageUrl = (path: string): string =>
  path ? [storeImageBase(), path.replace(/^\/+/, '')].join('/') : '';

/**
 * Is there anything in the shop?
 *
 * The shop sat in the site's main navigation from the day it was built, and
 * for most of that time pressing it reached a page that said there was nothing
 * for sale. That is a specific kind of damage on a premium site: a visitor
 * deciding whether this business is serious follows a link in the top bar and
 * finds an empty room. An absent link costs nothing; a link to nothing costs
 * the impression the rest of the page was working for.
 *
 * Counted with a head request, so the home page pays for a number rather than
 * for every product row it is not going to draw. The policy on `products`
 * already hides anything switched off, so this counts what a stranger would
 * actually be shown rather than what exists.
 */
export async function storeHasItems(sb: SupabaseClient): Promise<boolean> {
  try {
    const { data: producerId } = await sb.rpc('public_site_producer');
    if (!producerId || typeof producerId !== 'string') return false;
    const { count } = await sb
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('producer_id', producerId)
      .eq('active', true);
    return (count ?? 0) > 0;
  } catch {
    /* A shop that cannot be counted is not a shop that should be advertised.
       Failing closed here hides a link; failing open shows an empty room. */
    return false;
  }
}
