import 'server-only';
import { noteLoadFailure } from './loadFailures.ts';

export { noteLoadFailure, loadFailures } from './loadFailures.ts';

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

/* ── But an empty list is also what "nothing here yet" looks like ──────────
   Containment fixed the crash and introduced a quieter problem in its place.
   A read that fails returns no rows, and no rows is exactly what a guest list
   nobody has started looks like. So a broken query renders "אין עדיין
   אורחים" — which is not an error message, it is a confident statement of
   fact, and it is wrong.

   That is the same shape as the print stylesheet that produced a blank page:
   a failure whose output is indistinguishable from an ordinary correct state,
   so nobody reports it and everybody quietly believes it.

   The failures are collected for the length of one render, and the screen
   header says so. The empty states stay exactly as they are — an empty list
   should read as an empty list — and the one line that appears above them
   changes what the emptiness means.                                        */

/** Rows from a Supabase query, or an empty list if it failed for any reason —
 *  thrown, or returned as an error. Never null, so callers stop guarding the
 *  same thing twice. */
export async function safeRows<T>(
  label: string,
  query: PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.error(`[load] ${label} returned an error`, error);
      noteLoadFailure(label);
      return [];
    }
    return (data ?? []) as T[];
  } catch (e) {
    console.error(`[load] ${label} threw`, e);
    noteLoadFailure(label);
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
    noteLoadFailure(label);
    return fallback;
  }
}
