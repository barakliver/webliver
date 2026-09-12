/**
 * Which workspace the couple is looking at.
 *
 * The portal used to draw every workspace this reader can open, one under
 * the next, on a single page. With two of them that page was about thirty
 * thousand pixels tall and — the part that actually broke — it contained two
 * of every anchor. Each workspace rendered `id="budget"`, `id="tasks"` and
 * eighteen more, and each workspace's own navigation linked to `#budget`. A
 * browser resolves a fragment to the first match in the document, so every
 * link in the second event opened the first event's screen instead. Nothing
 * about it looked broken: the page scrolled, a budget appeared, and it was
 * somebody else's budget.
 *
 * One workspace is drawn at a time, and which one lives in the address. That
 * fixes the collision at its cause rather than by renaming anchors, because
 * with one workspace on the page there is exactly one of each; it also means
 * a couple can hold two celebrations open in two tabs, and that a link they
 * send each other opens the thing they were looking at.
 *
 * The value from the address is trusted exactly as far as this function: it
 * is matched against the workspaces the reader may actually read, and
 * anything else falls back to the first. An id naming somebody else's event
 * resolves to nothing here and gets the reader their own first workspace,
 * not an empty screen and not a screen belonging to anybody else. The fence
 * that makes that a security property rather than a convention is row level
 * security in the database; this is the half that decides what to draw.
 */

export function pickWorkspace<T extends { id: string }>(
  all: readonly T[],
  wanted: string | null | undefined,
): T | null {
  if (all.length === 0) return null;
  return all.find((w) => w.id === wanted) ?? all[0];
}

/**
 * The address for a different workspace, keeping everything else in the bar.
 *
 * Switching used to be written as a fresh `URLSearchParams` carrying only the
 * one value, which quietly dropped every other parameter — so moving between
 * celebrations inside a workspace forgot which workspace it was in, and the
 * reader landed back on the first one. Anything a screen puts in the address
 * is state; replacing the address wholesale throws that state away.
 */
export function withParam(
  current: URLSearchParams | string,
  key: string,
  value: string,
): string {
  const next = new URLSearchParams(current);
  next.set(key, value);
  return next.toString();
}
