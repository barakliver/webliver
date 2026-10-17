# Quiet luxury: the migration, screen by screen

The design system in Spec 6, as applied. Tokens and type are in
`globals.css` and `tailwind.config.ts`; the components in `/design`;
this file is the checklist of what moved on the screens and what did not.

## Removed from the product (Spec 6 §6)

| Rule | State | Where it is enforced |
|---|---|---|
| No `bg-gradient-*` | Done. Two remain and both are scrims over a photograph (`Hero`, `MediaVault`), which is not decoration but legibility. | by hand, `grep bg-gradient` |
| No `shadow-md/lg/xl` on cards; shadows only on what floats | Done. `shadow-lift` is `none`; `shadow-pop` and `shadow-fab` are on sheets, menus, toasts and the carried drag chip only. Three images lost their shadow. | `tailwind.config.ts` |
| No `font-bold` / `font-semibold` / `font-black` | Done. Zero outside `/design`. | by hand, `grep` |
| No coloured icon in a card title | Done. | by hand |
| No filled badge in a table; a dot and a word | Done. `StatusDot` is the default; `.chip-*` is outlined, not filled, and stays on the lead board and the filters. | `/design` |
| No `rounded-2xl/3xl` on buttons | Done. `control` is 10px, `card` 16, `sheet` 22. | `tailwind.config.ts` |
| No `bounce`, `pulse`, `scale` on hover | Done. The label swatch and the two photo zooms were the last three. | by hand, `grep` |
| No giant countdown, no emoji in headings, no exclamation marks in microcopy | Done. The countdown is one muted line under the couple's name. | by hand |
| No card inside a card | Done where it was a frame inside a frame. A `<details>` tray inside a `FoldGroup` is one object, not two cards. | by hand |
| No hex colour in components or pages | Done, with four kept on purpose: the sign-in page's Google mark (a brand), the global error page (it renders without the stylesheet), the board's downloadable image (drawn on a canvas), and the card game (Hebrew artwork with its own blue). | by hand, `grep '#[0-9a-fA-F]{6}'` |
| No `ml-/mr-/left-/right-` | Done. `npm run rtl` tokenises every class string and fails on a physical side; it is at zero and ratchets. | `scripts/check-rtl.mjs` in `npm run check` |
| Every text at 4.5:1 in light and dark | Done. `npm run contrast` holds a hand copy of both palettes against `globals.css`; `check:full` runs axe on `/design`. | `scripts/check-contrast.mjs`, `scripts/check-a11y.mjs` |

## Screens (Spec 6 §7, steps 4 and 5)

| Screen | What moved | Left as is, and why |
|---|---|---|
| `/login` | The brand name is the logo, display face at 300; no card around the form; a plain hairline instead of a gradient one. | The Google button keeps its brand colours. |
| `/app/portal` | Name in the display face; one muted line for the days, the date and the place; `StatBar` on the budget; "what this week" from the activity log; the questionnaire card until seventy percent; the wedding-day card in the last forty-five days. | The six drawers stay rows in one surface rather than four cards in a grid: the rows carry the count the brief wants on a card, and the argument for one object over six is in `CLAUDE.md`. |
| `/app/portal` budget | `BudgetGrid`: the sheet. | |
| Suppliers, replies, schedule | Unchanged in structure; take the tokens. | |
| `/app/portal/questionnaire` | New, on the system. | |
| `/app` (producer) | Takes the tokens; `WeekLog` and `StatBar` available. | The attention pile and the season list stay. |
| `/app/clients` | Takes the tokens. | |
| `/app/clients/[id]` | Profile tab, run-of-show tools, the sheet on the money tab. | |
| `/app/leads` | The board keeps its filled chips (allowed on a kanban). | |
| `/app/inbox` | Takes the tokens. | |

## QA (Spec 6 §7, step 7)

`design-qa/` holds the harness panels at 375 and 1280, light and dark,
taken with Playwright from `/design`. `npm run check:full` runs axe on
the same page.

## Dark mode (Spec 6 §7, step 8)

The three-way switch is in the accessibility menu and a one-press one in
the header. The day-of screen puts the dark palette on by itself from six
in the evening to six in the morning (`SunsetDark`) and takes it off on
leaving.

## Not done, and why

- The sidebar navigation at 240px with a 2px accent bar: the console's
  navigation is a strip of tabs on a phone-first product and was not
  rebuilt; it takes the tokens.
- Radix selects on desktop: native selects everywhere, which the brief
  allows on a phone and which is one implementation rather than two.
