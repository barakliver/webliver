/**
 * Open whatever the thing is inside, before scrolling to it.
 *
 * The couple's screen keeps everything it had and shows almost none of it at
 * rest: the sections live in folded drawers. That buys a short first screen
 * and it costs one thing — a link to `#payments` now points at something
 * inside a closed `<details>`, which in most browsers scrolls nowhere and
 * reads as a broken button.
 *
 * Two browsers unfold a fragment target on their own and the rest do not, so
 * this does it in all of them. It is the one piece of behaviour both ways in
 * are built on: the quick-jump at the bottom of the screen, and every ordinary
 * `#` link on the page.
 */

/** What this needs of an element, so the walk can be tested without a DOM. */
type Node = { tagName?: string; open?: boolean; parentElement: Node | null };

/** Unfolds every `<details>` this element is inside, innermost first.
 *
 *  By tag name rather than `instanceof HTMLDetailsElement`: the two are the
 *  same answer in a browser, and only one of them can be asked a question in
 *  a test. */
export function unfold(el: Node | null): void {
  let p = el;
  while (p) {
    if (p.tagName === 'DETAILS') p.open = true;
    p = p.parentElement;
  }
}

/**
 * Unfolds the target of a fragment and hands it back, or null when the page
 * has nothing by that name. Scrolling is left to the caller: a click on an
 * ordinary link wants the browser's own behaviour, and the quick-jump wants
 * to move the focus with it.
 */
export function reveal(hash: string): HTMLElement | null {
  /* A fragment written by a person can arrive percent-encoded, and an id on
     this screen is ASCII either way — so decoding can only help, and a
     malformed one must not throw on the way to a scroll. */
  let id = hash.replace(/^#/, '');
  try { id = decodeURIComponent(id); } catch { /* keep it as written */ }
  if (!id) return null;
  /* An id may be anything at all, and `getElementById` is happy with all of
     it — unlike a selector, which would need the id escaped first. */
  const el = document.getElementById(id);
  if (!el) return null;
  unfold(el);
  return el;
}
