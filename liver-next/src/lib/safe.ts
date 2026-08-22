import 'server-only';

/* ── One panel failing is not the page failing ─────────────────────────────
   An event screen is a dozen independent reads: tasks, guests, seating, the
   run sheet, money, the thread, contracts, signed image links. Awaited
   together, any one of them throwing takes the whole screen down, and the
   producer sees an error instead of the eleven things that were fine.

   That happened twice on this page, and both times the cause was invisible
   from the screen itself. The fix that outlives any particular cause is
   structural: a failure is contained to the thing that failed, everything
   else renders, and the reason goes to the server log carrying the name of
   the part that broke rather than a stack trace nobody reads.               */

/** Rows from a Supabase query, or an empty list if it failed for any reason —
 *  thrown, or returned as an error. Never null, so callers stop guarding the
 *  same thing twice. */
export async function safeRows<T>(
  label: string,
  query: PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) { console.error(`[load] ${label} returned an error`, error); return []; }
    return (data ?? []) as T[];
  } catch (e) {
    console.error(`[load] ${label} threw`, e);
    return [];
  }
}

/** The same containment for anything that is not a query: a storage call, a
 *  loader that makes several. */
export async function safeValue<T>(label: string, work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (e) {
    console.error(`[load] ${label} threw`, e);
    return fallback;
  }
}
