import { cache } from 'react';

/**
 * Which reads broke while this screen was being built.
 *
 * Split out of `safe.ts` rather than living in it, for one reason: safe.ts is
 * marked `server-only`, which is correct for a module that runs queries and
 * also means node cannot import it outside the bundler. This half is nothing
 * but a list, and keeping it separate is what lets the part with a decision
 * in it be tested instead of assumed.
 *
 * The scoping and the logic are deliberately two things here.
 *
 * `cache` called with no arguments gives one list per render pass: every
 * caller inside one request gets the same array and the next request starts
 * empty. That is the documented behaviour inside a Server Component and it is
 * the same mechanism that stops the account being fetched four times a page.
 * It also does nothing at all outside a render — a plain call in a test gets
 * a fresh array every time, which is worth writing down because it means the
 * scoping cannot be covered by a unit test and should not be pretended at.
 *
 * If that scoping ever stopped working the failure is quiet and harmless:
 * the list reads empty, the header says nothing, and the product is back to
 * the behaviour it had before any of this existed. It cannot fail the other
 * way — one request cannot inherit another's warning — because the array is
 * never module-level.
 *
 * What can be got wrong is the small amount of judgement in `addOnce`, and
 * that is a pure function with tests.
 */
const failures = cache((): string[] => []);

/**
 * Adds a label to a list, once.
 *
 * Named rather than counted, and deduplicated: two panels reading the same
 * table both fail on the same afternoon, and the screen should say so once
 * instead of stacking two identical lines above the title. Order is kept —
 * not for the screen, which says one sentence either way, but for anybody
 * reading the list to work out which read went first.
 */
export function addOnce(list: string[], label: string): string[] {
  const name = label.trim();
  if (name && !list.includes(name)) list.push(name);
  return list;
}

/** Names one read as having failed. */
export function noteLoadFailure(label: string): void {
  addOnce(failures(), label);
}

/**
 * What failed, in the order it broke.
 *
 * Read from the page header, which renders after a page has finished awaiting
 * its own queries. A read inside a nested server component can finish after
 * that and go unmentioned — the log still carries it, and the header is the
 * common case rather than the complete one.
 */
export function loadFailures(): readonly string[] {
  return failures();
}
