# Lux direction — what changed

This supersedes the light Apple-luxury spec in `README.md`. **Build this.** The original README stays valid for structure, screen inventory, copy, bar formulas, state and the RTL bidi rules. Everything visual below overrides it.

Source of truth: `Event Platform Lux.dc.html`. Interactive preview: `preview-lux.html`.

## Type

Two families, loaded from Google Fonts.

- **`'Frank Ruhl Libre', serif`** — headings, all large numbers, all currency and metric values, brand marks. Weight **300** almost everywhere (400 only at small sizes). Positive tracking: `letter-spacing: .01em` to `.02em`. Never bold it.
- **`Heebo`** — body, labels, buttons, table cells. Weights 200 to 500. Buttons and kickers use uppercase-style tracking: `.10em` to `.28em`.

Display sizes: site hero `clamp(42px, 7.4vw, 104px)`. App opening title 46px. Portal countdown 104px. Bar result 62px. Web page title 44px. KPI values 42px.

## Color

| Token | Value | Use |
| --- | --- | --- |
| ink | `#1A1613` | Text, primary fill. Warm near-black, not slate |
| ink-muted | `#6B6259` | Body copy |
| ink-faint | `#A79881` | Kickers, meta, inactive nav. Warm, not grey |
| gold | `#B08D57` | Hairlines, active marks, accent numerals |
| ivory | `#FAF7F2` | Screen ground |
| ivory-bright | `#FFFDF9` | Producer dashboard ground |
| canvas | `#EDEAE4` | Page behind the artboards |
| dark | `#0E0C0A` | Bride Mode, bar result panel, site CTA band |

No white, no slate, no blue. The whole palette is warm.

## Surfaces — the biggest change

**There are no cards.** No glassmorphism, no `backdrop-filter` on content, no 24px radii, no shadows on content. Structure comes from **hairlines**:

- `1px solid rgba(26,22,19,.09)` between rows.
- `1px solid rgba(26,22,19,.16)` above a group.
- Gold accent rules fade out: `linear-gradient(90deg, rgba(176,141,87,0), #B08D57 30%, rgba(176,141,87,.1))`.

Buttons are **square** (`border-radius: 0`). Primary is a solid ink block, secondary a 1px ink outline on transparent. Chips are rectangles with a 1px border, not pills. Only avatars, FABs and the small circular controls are round.

Shadows exist only under the device shells and the contact FAB.

## Motion

Every transition is `cubic-bezier(.16, 1, .3, 1)` at **350ms to 1000ms**. Screen entry: `@keyframes veil` — `opacity 0 → 1`, `translateY(16px) → 0`, 550-700ms.

## 3D — implement these, they carry the impression

1. **Site hero parallax.** `onMouseMove` on the hero measures the cursor as a -0.5 to 0.5 offset of the element box. The image layer (inset `-4%`, `scale(1.05)`) translates `x * -26px, y * -18px`; the text block translates `x * 14px, y * 10px`. Both at 900ms. Reset to 0 on mouse leave. The container has `perspective: 1400px`.
2. **Phone stage.** The showcase phone sits in `perspective: 1500px` with `transform-style: preserve-3d` and rotates with the cursor: `rotateY(-14deg + x*16deg) rotateX(7deg - y*12deg)` at 1000ms, over a 9s `floatSlow` translate loop.
3. **Bride Mode tiles.** Every third tile gets `translateZ(14px)` inside a `perspective: 900px` column.
4. **Ambient marks.** A large thin circle on the hero and a radial gold glow on the dark band, both on a slow `shimmer` opacity loop. Decorative, `pointer-events: none`.

Respect `prefers-reduced-motion`: disable the parallax and the float loops, keep the fades.

## Screen deltas against the original README

- **App opening** — full-bleed image, gold hairline, kicker, serif title on two lines, two square buttons. Nothing else. The "החלפת תמונה" chip is a square outlined tag at top-left.
- **Login** — no card. The OTP cells are 46×60 with **only a bottom border**, serif 26px digits; the border turns gold when filled. No box, no fill, no focus ring shadow.
- **Portal** — image header with the couple's names in serif over it, then `200` at 104px, then four hairline rows (תקציב, אישורי הגעה, כספת השראה, חמ״ל ספקים) each with a serif value and a thin chevron. Six widgets became four rows.
- **Bride Mode** — the one dark screen. `#0E0C0A` ground, gold kicker, palette selectors as bordered rectangles, tiles with 3D depth, circular like buttons over dark glass.
- **Bar calculator** — no cards; sliders separated by space, the mix control is a full-width three-way block between two hairlines, results on a dark `#0E0C0A` panel with a fading gold rule.
- **Budget** — two serif figures side by side above a hairline, then category rows with 1px tracks.
- **Vendors** — filter row is underlined text, not chips. Rows are hairline-separated; status is coloured text, no tag background.
- **Bottom nav** — five underlined text labels spread across the width, gold underline on the active one. No dock, no pill, no icons. It inverts to light-on-dark automatically on Bride Mode (`dark` flag driven by the route).
- **Producer dashboard** — ivory-bright ground, sidebar separated by a hairline with a gold right-edge mark on the active item, segmented control is underlined text, KPIs are serif numerals over top rules, the table has no fills.
- **Site** — hero with parallax, a phone-stage section with the numeral `200` set huge at 4.5% opacity behind it, three numbered steps as hairline rows (I, II, III in serif gold), a dark CTA band with a gold glow, and a hairline footer.

## Everything unchanged

Screen inventory, all Hebrew copy, bar-calculator formulas, budget and vendor data, state shape, the email OTP flow, the contact and report sheets, and the Unicode LTR isolate rule for every number and currency string. Read `README.md` for those.
