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
