# Prompt for Claude Code

Paste this into Claude Code from the repository root, with this folder available.

---

I'm replacing the entire visual layer of this event and wedding production platform. The design is in `design_handoff_event_platform/`.

Read these first, in this order:

1. `design_handoff_event_platform/README.md` — the full specification. Every screen, every exact value, the bar-calculator formulas, all Hebrew copy, and the RTL bidi rules.
2. `design_handoff_event_platform/preview-standalone.html` — open it in a browser to see and click the intended result.
3. `design_handoff_event_platform/Event Platform.dc.html` — the design source. All styling is inline; when the README and this file disagree, this file wins.

Then, before writing anything, report back to me:

- What framework and styling approach this repo actually uses.
- Where the existing screens live and which ones map to the screens in the README.
- Whether Tailwind is already set up, and if so how the config differs from `tailwind.config.ts` in the handoff folder.

Do not start implementing until we have agreed on that mapping.

## Ground rules for the implementation

- The HTML files are **design references**, not production code. Recreate them using this repo's existing patterns, router, data layer and component conventions.
- **Replace the old visual language entirely.** Do not preserve the previous styling.
- Merge `tailwind.config.ts` and `globals.css` from the handoff folder into the repo's own versions rather than overwriting them wholesale.
- Icons: use **lucide-react** at `strokeWidth={1.5}`. The icons in the prototype are hand-drawn placeholders — do not copy their SVG paths. The README lists the intended lucide equivalents.
- **No em dashes** in any Hebrew or English copy. This is an editorial rule from the brand.
- Hebrew copy in the README is final. Do not rewrite it, do not "improve" it, do not translate it.
- Every mixed number and every currency string must be wrapped in a Unicode LTR isolate with `white-space: nowrap` (the `.ltr-num` utility is in the handoff config). Without it, `218 / 340` renders reversed and `₪228,000` puts the shekel sign on the wrong side. The README has the full list of affected strings.
- The accent color is a white-label token (`--accent`). Drive it from the producer record; never hard-code the gold.
- Photography is not supplied. Use the repo's existing placeholder pattern for the hero and the eight moodboard tiles.
- The prototype's surface switcher, `עב`/`EN` toggle, phone bezel and screen list are demo chrome. Do not ship them.

## Suggested order of work

1. Tokens: merge the Tailwind theme and `globals.css`, verify Heebo loads and RTL is set on `<html>`.
2. Primitives: card surface (three variants), chip, segmented control, status tag, primary and secondary button, the `Ltr` number wrapper.
3. Login card with the 6-digit OTP behavior (auto-advance, Backspace retreat). Note: the code is sent **by email**, not SMS.
4. Landing page and hero.
5. Mobile app shell: bottom navigation plus the two floating actions and both bottom sheets.
6. Couple dashboard bento grid.
7. Bar calculator — implement the formulas in the README exactly, they are the source of truth.
8. Budget and payments, vendor ops.
9. Bride Mode moodboard.
10. Producer web dashboard.

Work screen by screen. After each one, show me a screenshot and wait before continuing.

## Known gaps

These are named in the brief but not yet designed. Flag them rather than inventing them: English locale and LTR mirroring, RSVP and seating screens, run-of-show editor with PDF export, Super Admin, error and loading states, sheet accessibility (Escape, focus trap, scroll lock), tablet breakpoint for the producer dashboard.
