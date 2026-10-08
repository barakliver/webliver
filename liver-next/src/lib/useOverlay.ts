'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * The four things a thing that opens over the page has to get right.
 *
 * `Sheet` got all four and said so in a comment. Of the thirteen other places
 * in this product that put `role="dialog"` over the screen, six returned
 * focus to nothing and two had no keyboard exit at all. None of that is
 * visible on a screen and none of it is catchable by the automated pass:
 * `check-a11y` prints "close a dialog: focus returns to the control that
 * opened it" in its own list of things still to try by hand, because axe
 * reads a tree and this is a sequence.
 *
 * So the sequence lives here once:
 *
 *   **Escape closes it.** A keyboard is not only a desktop thing, and a
 *   modal with no keyboard exit is a trap. `Shop`'s cart and the supplier
 *   capture were traps.
 *
 *   **Focus moves in on open and back to whatever opened it on close.**
 *   Otherwise somebody navigating by keyboard is dropped at the top of the
 *   page every time they close something, and has to tab back down through
 *   the whole screen to carry on.
 *
 *   **The page behind stops scrolling**, or a swipe meant for the panel
 *   scrolls the document under it and the panel appears frozen. The scroll
 *   position is put back on close, because locking with `overflow: hidden`
 *   loses it on some engines.
 *
 *   **Back closes the panel rather than the screen behind it.** On a phone
 *   this is not a nicety: the panel covers the page, so the gesture that
 *   means "undo the last thing that happened" is a swipe from the edge, and
 *   with no entry of our own on the stack that gesture threw away the whole
 *   event file instead of the form on top of it.
 *
 * Pure behaviour and no wording, which matters: `GameTable` wrote these out
 * by hand rather than import `Sheet`, because `Sheet` reads one label from
 * `useCopy()` and the card game is a route whose whole design is that it is
 * not the app. A hook that asks for nothing can be used by both.
 *
 * It takes a ref rather than returning one so a caller that already has one
 * on its panel keeps it.
 */
export function useOverlay(
  open: boolean,
  onClose: () => void,
  panel: RefObject<HTMLElement | null>,
  { history: useHistory = true, focus }: {
    /* Off for a panel that is not a page in its own right - a menu that
       closes when you look away should not eat somebody's Back. */
    history?: boolean;
    /* What to put the caret in, where the first focusable is not it. The
       card game's notepad wants the pad and not the button beside it:
       landing on a button in a panel whose whole purpose is to type is a
       keypress somebody has to undo before they can start. */
    focus?: string;
  } = {},
) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const opener = document.activeElement;
    const scrollY = window.scrollY;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); }
    };
    window.addEventListener('keydown', onKey);

    /* One entry pushed on open and popped on close, and the flag keeps the
       close from pushing a second one. */
    let ours = false;
    let onPop: (() => void) | undefined;
    if (useHistory) {
      try { history.pushState({ overlay: true }, ''); ours = true; }
      catch { /* a browser that refuses the push keeps the old behaviour */ }
      onPop = () => { ours = false; close.current(); };
      window.addEventListener('popstate', onPop);
    }

    /* After paint, or the element is not focusable yet. */
    const id = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>(
        focus ?? 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      /* Nothing focusable inside is a real case - a panel that is only a
         message. Focus the panel itself so a screen reader is inside it and
         Escape reaches the handler. */
      (first ?? panel.current)?.focus?.();
    });

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
      if (onPop) window.removeEventListener('popstate', onPop);
      /* Closed by Escape, the backdrop or a save rather than by Back, so the
         entry we pushed is still on the stack and has to come off. Closed by
         Back and the browser already took it. */
      if (ours) { try { history.back(); } catch { /* nothing to go back to */ } }
      document.body.style.overflow = overflow;
      window.scrollTo(0, scrollY);
      (opener as HTMLElement | null)?.focus?.();
    };
    /* `onClose` is read through a ref rather than listed here. A caller that
       passes an arrow function makes a new one every render, and with it in
       the list this whole effect tore down and rebuilt on every keystroke
       inside the panel - which re-ran `document.activeElement` and pulled
       the caret straight back out of the field. That is the bug `GameTable`
       already hit and wrote a ref for. */
  }, [open, panel, useHistory, focus]);
}
