# Handoff: Event & Wedding Production Platform (Hebrew RTL)

## Overview

A white-label event production platform for a single producer brand (ברק ליור הפקות) with two surfaces:

1. **Mobile PWA** — a couple-facing portal (landing → OTP login → dashboard → moodboard → bar calculator → budget → vendor ops).
2. **Web producer dashboard** — a denser desktop view over the same data (KPIs, vendor table, run-of-show, bar summary).

All copy is Hebrew, layout is RTL. The visual language is light Apple-luxury: Heebo, frosted-glass surfaces, obsidian primary, muted gold micro-accents, squircle radii.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly.

- `Event Platform.dc.html` — the authoritative source. It is a single HTML file containing a template (markup) and a logic class (a React-class-like component). All styling is **inline style objects**, no CSS classes. Read it for exact values.
- `preview-standalone.html` — a self-contained bundled build. Open it in a browser to interact with the design (including on a phone). Do not read it as source; it is compiled output.

The task is to **recreate these designs in the existing codebase** using its established patterns and libraries. The project was built with Claude Code; the intended target per the original brief is **Next.js + Tailwind CSS + lucide-react**, so the token table below is expressed to drop into `tailwind.config.ts`.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, shadows and copy are final. Recreate pixel-perfectly. Every value below is taken from the prototype source, not approximated.

## Design Tokens

### Colors

| Role | Value | Usage |
| --- | --- | --- |
| ink | `#0F172A` | Headings, primary CTA fill, active nav, dark bar-calculator card |
| ink-muted | `#475569` | Body copy, secondary labels |
| ink-faint | `#64748B` | Captions, meta text |
| placeholder | `#94A3B8` | Kickers, placeholders, inactive nav icons |
| line | `#E2E8F0` | Progress-bar tracks, hard borders |
| line-soft | `rgba(226,232,240,.6)` – `rgba(226,232,240,.95)` | Glass borders, input borders |
| canvas | `#F1F5F9` | Page ground |
| surface-glass | `rgba(255,255,255,.78)` | Card fill (default variant) |
| gold | `#B08D57` | Micro-accents, gold progress fills, "בהמתנה" tags, feature icons |
| gold-light | `#D8BC8A` | Gold text on the dark card |
| gold-tint | `rgba(176,141,87,.14)` | Pending status chip, sent-state button |

Page background gradient: `radial-gradient(120% 80% at 80% 0%, #FFFFFF 0%, #F8FAFC 45%, #EEF2F7 100%)`

### Glassmorphism

The single most-repeated surface recipe (default card variant):

```css
background: rgba(255,255,255,.78);
backdrop-filter: blur(24px);
border: 1px solid rgba(226,232,240,.6);
box-shadow: 0 1px 2px rgba(15,23,42,.04);
```

Two alternates exist as a variant prop (`cardStyle`):
- `solid` — `background:#fff; border:1px solid rgba(241,245,249,1); box-shadow:0 14px 34px -22px rgba(15,23,42,.3)`
- `outline` — `background:rgba(255,255,255,.45); border:1px solid #E2E8F0; box-shadow:none`

### Typography

Family: `-apple-system, BlinkMacSystemFont, "Heebo", "Assistant", sans-serif`. Heebo loaded from Google Fonts at weights 300–800.

| Element | Size | Weight | Letter-spacing | Notes |
| --- | --- | --- | --- | --- |
| Hero title (mobile) | 40px / 1.08 | 800 | -.035em | `text-wrap: balance` |
| Web page title | 32px | 800 | -.035em | |
| Screen title (mobile) | 26px | 700 | -.03em | |
| Sheet title | 20px | 700 | -.03em | |
| Big metric | 46px / .95 | 800 | -.04em | Countdown |
| Bar-calculator metric | 40px / 1 | 800 | -.04em | On dark card |
| Card metric | 21–22px | 700 | -.02em | |
| KPI value (web) | 27px | 700 | -.03em | `white-space: nowrap` |
| Card / section header | 15px | 600 | -.01em | |
| Body copy | 13.5–15px / 1.6–1.65 | 400 | — | Hebrew readability |
| Row label | 13.5–14.5px | 500–600 | -.01em | |
| Caption / meta | 11–12.5px | 500 | — | |
| Kicker | 11px | 500 | .12em–.14em | Uppercase-style spacing |

Editorial rule from the brief: **no em dashes anywhere**. Hebrew geresh/gershayim are used (`חמ״ל`, `לו״ז`, `דיג׳יי`).

### Radii

| Token | Value | Applied to |
| --- | --- | --- |
| card | 24px | Widget cards, dark bar card |
| card-sm | 20–22px | Vendor rows, feature cards, KPI cards |
| sidebar | 26px | Web sidebar, login card (26px) |
| sheet | 30px 30px 0 0 | Bottom sheet |
| control | 14–16px | Buttons, inputs, OTP cells, textarea |
| pill | 999px | Chips, segmented controls, nav dock, FABs |
| phone-screen | 44px inner / 54px bezel | Device shell |

### Spacing

Page padding `22px 26px 60px`. Mobile screen gutter `20–24px`. Card padding `18px` (mobile widgets), `15px` (feature cards), `14px 15px` (vendor rows), `20px` (dark card), `28px 22px` (login card), `20px 22px 30px` (sheet). Grid/flex gaps: `8px` inside cards, `10px` between cards, `14–16px` on web, `6–8px` between chips.

### Shadows

| Use | Value |
| --- | --- |
| Card ambient | `0 1px 2px rgba(15,23,42,.04)` |
| Primary CTA | `0 12px 26px -14px rgba(15,23,42,.7)` |
| Contact FAB | `0 18px 36px -18px rgba(15,23,42,.75)` |
| Report FAB | `0 14px 30px -18px rgba(15,23,42,.45)` |
| Nav dock | `0 22px 45px -22px rgba(15,23,42,.45)` |
| Login card | `0 26px 60px -34px rgba(15,23,42,.35)` |
| Dark bar card | `0 24px 50px -30px rgba(15,23,42,.9)` |
| Bottom sheet | `0 -20px 50px -30px rgba(15,23,42,.6)` |
| Device bezel | `0 40px 80px -40px rgba(15,23,42,.5), 0 0 0 1px rgba(15,23,42,.6)` |

## RTL / Bidi — read this before writing any number

Under `direction: rtl`, neutral characters (`/`, `₪`) reorder around digit runs. The prototype fixes this with **Unicode isolates**, and the implementation must too.

- Wrap every mixed number string and every currency string in U+2066 (LRI) … U+2069 (PDI): `'\u2066' + '₪' + '228,000' + '\u2069'`.
- Affected strings: `218 / 340`, all `₪…` amounts, the login email address.
- Also set `white-space: nowrap` on those value spans — the web KPI card wraps to two lines and overflows without it.
- Equivalent React approach: a `<Ltr>` helper that renders `<span dir="ltr" style={{unicodeBidi:'isolate', whiteSpace:'nowrap'}}>`.
- Number formatting itself uses `toLocaleString('en-US')` (Western digits, comma groups).

## Screens / Views

### 1. Landing (mobile, route `landing`)

**Purpose:** brand entry, drives to booking or login.

Layout: a 430px-tall hero, then two stacked CTAs, then a 2-column feature grid.

- **Hero image** — full-bleed `image-slot` placeholder (drop target in the prototype; in production a real photo). Overlaid scrim, `pointer-events:none`: `linear-gradient(180deg, rgba(15,23,42,.42) 0%, rgba(15,23,42,.05) 38%, rgba(255,255,255,.75) 82%, #FFFFFF 100%)`.
- **Kicker** — `ברק ליור · הפקות אירועים`, 11px/500, `.14em`, `#475569`, 12px bottom margin.
- **Title** — `רגע מאושר שישאר לנצח` (exact, no period), 40px/800/-.035em, `#0F172A`.
- **Sub** — `פלטפורמת הפקה אחת לכל שלב של האירוע. מהפגישה הראשונה ועד הריקוד האחרון.` 15px/1.65/400, `#475569`, `max-width:300px`.
- **CTA primary** — `קביעת פגישה`, full width, 52px, radius 16, `#0F172A` on white text, 15px/600.
- **CTA secondary** — `כניסה לאזור האישי`, same box, glass fill, 1px `rgba(226,232,240,.9)` border, ink text.
- **Feature cards** — 2×2 grid, gap 10px, radius 20, padding 15, gap 7 internally. Icon 22px, `stroke #B08D57`, `strokeWidth 1.5`. Title 14px/600/-.01em; body 12px/1.55/400 `#64748B`.
  1. `מיתוג דינמי` / `שם, לוגו וצבעים לכל מפיק`
  2. `פורטל זוגות` / `מסך אישי לכל אירוע`
  3. `תקציב ובר` / `חישוב מדויק בזמן אמת`
  4. `כספת השראה` / `Bride Mode לשמירת רעיונות`

Both CTAs navigate to the login route. No bottom nav on this screen.

### 2. Login + OTP (mobile, route `login`)

**Purpose:** passwordless entry. **The code is delivered by email, not SMS.**

- Centered glass card, radius 26, padding `28px 22px`, `backdrop-filter: blur(28px)`, shadow `0 26px 60px -34px rgba(15,23,42,.35)`. **No avatar or profile image.**
- Title `כניסה לאזור האישי`, 24px/700/-.03em.
- Sub: `שלחנו קוד בן 6 ספרות למייל` + the address in ink 600, LTR-isolated, nowrap.
- **OTP row** — `dir="ltr"`, flex, gap 8, 6 cells. Each cell 46×56, radius 14, centered 22px/600 text, `inputMode="numeric"`, `maxLength=1`.
  - Empty: `border 1px solid rgba(226,232,240,.95)`, `background rgba(248,250,252,.9)`.
  - Filled: `border 1px solid #0F172A`, `background #fff`, `box-shadow 0 0 0 3px rgba(15,23,42,.08)`.
  - Transition `all .2s ease`.
  - Behavior: typing a digit auto-advances focus to the next cell; Backspace on an empty cell moves focus back. Input is sanitized to `[0-9]`, last character wins.
- Submit `אישור והמשך` — 52px, radius 16, obsidian, navigates to the dashboard.
- Footer: `לא קיבלתם? בדקו בתיקיית הספאם או ` + `שלחו קוד חדש` (gold 600). 13px/500, line-height 1.7, centered.
- Below the card: `ההתחברות מאובטחת ומשויכת למפיק ברק ליור`, 12px `#94A3B8`, centered.

### 3. Couple portal / dashboard (mobile, route `home`)

Header: kicker `שלום נועה ואיתי` 12px/500 `#94A3B8`; title `החתונה שלכם` 26px/700/-.03em; a 42×42 radius-14 glass bell button on the opposite side.

Widget grid — three layout variants (`dashboardLayout` prop):
- `bento` (default): `grid-template-columns: 1fr 1fr; gap:10px`, with the countdown and vendor cards spanning both columns.
- `columns`: same 2-col grid, no spans.
- `list`: single column flex, gap 10.

Cards (all radius 24, padding 18, flex column gap 8, 20px icons at `strokeWidth 1.5`):

1. **Countdown (wide)** — meta row `12.03.2027 · אחוזת אלמא` (12px/500 `#94A3B8`) and `בהפקה` (11px/600 gold). Metric `200` at 46px/800 + `ימים לאירוע` 15px/500 with 6px bottom padding. 5px progress track `#E2E8F0`, fill 38% `linear-gradient(90deg,#0F172A,#475569)`. Caption `38% מהמשימות הושלמו · המשימה הבאה: טעימות קייטרינג`.
2. **תקציב** → budget screen. Value `₪228,000` (isolated), 4px track, 49% gold fill, caption `שולם ₪111,500`.
3. **אישורי הגעה** — `218 / 340` (isolated, nowrap), 64% ink fill, caption `14 שולחנות הושבו`.
4. **כספת השראה** → moodboard. Gold sparkle icon, `24 שמורים`, caption `Bride Mode · פלטת שמנת וזהב`.
5. **בר ואלכוהול** → bar calculator. Value `<bottles> בקבוקים` (live from the calculator), caption `לפי 240 מוזמנים · 5 שעות`.
6. **חמ״ל ספקים (wide)** → vendors. Header row with `2 בהמתנה` in gold. Chip row: `קייטרינג`, `דיג׳יי`, `צילום`, `עיצוב`, `ברמנים` — 12px/500 `#475569` on `rgba(241,245,249,.9)`, radius 999, padding `6px 11px`.

**Floating actions (this screen only):** absolutely positioned row, `justify-content: space-between`, `padding: 0 18px`, `bottom: 92px` (bottombar) / `96px` (dock) / `26px` (tabs), `z-index: 25`.
- **Right side (RTL first child): contact FAB** — 50×50 circle, `#0F172A`, white 20px phone icon, shadow `0 18px 36px -18px rgba(15,23,42,.75)`, `title="שיחה עם המפיק"`.
- **Left side: report FAB** — 38×38 circle, glass (`rgba(255,255,255,.9)`, blur 20, `1px rgba(226,232,240,.9)`), `#475569` 17px warning-triangle icon, shadow `0 14px 30px -18px rgba(15,23,42,.45)`, `title="דיווח על בעיה"`.

### 4. Bottom sheets (contact / report)

Backdrop `rgba(15,23,42,.28)` + `blur(3px)`, `z-index: 40`, closes on backdrop click only (the sheet itself must stop propagation). Sheet: full width, `rgba(255,255,255,.94)` + `blur(30px)`, radius `30px 30px 0 0`, padding `20px 22px 30px`, gap 14, 38×4 grab handle in `#E2E8F0` centered. Entry animation `rise .28s ease` (`opacity 0 → 1`, `translateY(10px) → 0`).

**Contact sheet**
- Title `ברק ליור · מפיק האירוע`; sub `זמין בימים א׳ עד ה׳, 09:00 עד 19:00`.
- Three 50px rows, radius 16, padding `0 16px`, gap 11, 18px icon, label flex-1 right-aligned, meta 12px/500 at 65% opacity:
  1. `שיחה טלפונית` / `050-4123900` — primary: obsidian fill, white text.
  2. `הודעה בוואטסאפ` / `מענה עד שעה` — `rgba(248,250,252,.9)`, 1px border.
  3. `קביעת פגישה` / `יומן פנוי` — same secondary style.

**Report sheet**
- Title `דיווח על בעיה`; sub `הדיווח נשלח ישירות לחמ״ל ההפקה ומתועד באירוע.`
- Topic chips (single-select, default `לו״ז ותזמון`): `לו״ז ותזמון`, `ספק לא עונה`, `תשלום`, `אישורי הגעה`, `תקלה באפליקציה`, `אחר`.
- Textarea: min-height 88, `resize:none`, padding `13px 14px`, radius 16, `1px rgba(226,232,240,.95)`, `rgba(248,250,252,.9)`, 13.5px/1.6. Placeholder `מה קרה? אפשר להוסיף פרטים`.
- Submit: 50px, radius 16, obsidian → on send becomes `rgba(176,141,87,.14)` with gold text and no shadow; label `שליחת דיווח` → `הדיווח נשלח לחמ״ל`. Transition `all .25s ease`.

### 5. Bride Mode moodboard (mobile, route `mood`)

- Kicker `BRIDE MODE` (gold, 12px/500, `.12em`), title `כספת השראה`, sub `שמרו רעיונות, סמנו לב, והמפיק רואה הכל בזמן אמת.`
- **Palette selector** — three cards, radius 16, padding `10px 12px`, gap 7. Selected: `#fff` + `1px #0F172A`; unselected: `rgba(255,255,255,.6)` + `1px rgba(226,232,240,.9)`. Each shows five 16×16 radius-3 swatches overlapping by `margin-left:-3px` with a 1.5px white border, plus an 11px/500 name.
  - `שמנת וזהב` — `#F6F1E7 #E8D9BE #C9A96A #8A7654 #3F3626`
  - `אבן וחול` — `#F2F1EE #DCD8D0 #B7AFA3 #7C766C #3A3833`
  - `ערב כהה` — `#EEF1F6 #C8CEDB #8794AC #4A5568 #1B2233`
- **Masonry** — CSS `columns: 2; column-gap: 10px`; tiles `break-inside: avoid`, `margin-bottom: 10px`, heights `150 112 190 128 164 120 142 176`. Each tile is an image placeholder at radius 18.
- **Like button** — 30×30 circle bottom-left of each tile, glass, `z-index: 4`. Inactive: `#94A3B8` outline heart. Active: gold stroke **and** gold fill. Tiles 2 and 5 start liked. Transition `all .2s ease`.

### 6. Bar calculator (mobile, route `bar`)

Title `מחשבון בר`, sub `כמה אלכוהול להזמין, לפי כמות מוזמנים ואורך האירוע.`

**Inputs card** (default card style) with three range sliders (`accent-color: #0F172A`, full width, label 13px/500 left, value 15px/700/-.02em right, 8px gap, `4px 0 12px` padding):

| Label | Min | Max | Step | Default |
| --- | --- | --- | --- | --- |
| `מוזמנים` | 60 | 600 | 10 | 240 |
| `שעות אירוע` | 3 | 9 | 1 | 5 |
| `אחוז שותים` (shown with `%`) | 30 | 100 | 5 | 75 |

Then a 3-up chip row (`flex:1` each): `מגוון` (default), `יין ובירה`, `קוקטיילים`.

**Results card** — `#0F172A`, radius 24, padding 20, gap 14, white text.
- Row: `סה״כ להזמנה` at 60% white / total cost in `#D8BC8A`, isolated.
- Metric: bottle count 40px/800 + `בקבוקים` 16px/500 at 65% white.
- Breakdown list above a `1px rgba(255,255,255,.12)` top border, rows 13.5px, label at 82% white / qty 600.
- Outlined button `שליחת הזמנה לספק` — 46px, radius 14, transparent, `1px rgba(255,255,255,.22)`.

**Formulas (implement exactly):**

```
drinks   = round(guests * (drinkers/100) * (1 + 0.8 * (hours - 1)))
split    = מגוון      → [wine .36, beer .34, spirits .30]
           יין ובירה  → [.45, .42, .13]
           קוקטיילים  → [.22, .26, .52]
wine     = ceil(drinks * split[0] / 5)      // 5 glasses per bottle
beer     = ceil(drinks * split[1])          // 330ml bottles, 1 per drink
spirits  = ceil(drinks * split[2] / 16)     // 16 shots per 0.7L bottle
soft     = ceil(guests * 0.55)
bottles  = wine + ceil(beer / 6) + spirits  // beer counted in six-packs
cost     = wine*68 + beer*11 + spirits*145 + soft*7   // ₪
```

Breakdown labels: `יין` → `<n> בקבוקים`; `בירה` → `<n> בקבוקי 330`; `אלכוהול חריף` → `<n> בקבוקים`; `שתייה קלה` → `<n> בקבוקים`. Each is LTR-isolated.

### 7. Budget & payments (mobile, route `budget`)

Title `תקציב ותשלומים`, sub `כל התשלומים במקום אחד, מסונכרן עם המפיק.`

Two summary cards side by side (gap 10): `שולם` `₪111,500` in ink; `נותר` `₪116,500` in gold. Both 22px/700/-.02em, isolated, nowrap.

Category list inside one card; each row is `9px 0` with a `1px rgba(226,232,240,.7)` bottom border, gap 7: name 14px/500 ink; total 13.5px/600 `#475569` (isolated, nowrap); 4px track with fill = `paid/total`; note 11.5px `#94A3B8`.

| Category | Total | Paid |
| --- | --- | --- |
| אולם ומזון | 120,000 | 60,000 |
| מוזיקה והגברה | 28,000 | 14,000 |
| צילום ווידאו | 24,000 | 8,000 |
| עיצוב ופרחים | 19,000 | 19,000 |
| בר ואלכוהול | 16,000 | 0 |
| הפקה וניהול | 21,000 | 10,500 |

Fill color: gold while partially paid, `#0F172A` when fully paid. Note text: `שולם במלואו` when complete, otherwise `שולם ₪X · נותר ₪Y` (both amounts isolated).

### 8. Vendor ops / חמ״ל ספקים (mobile, route `vendors`)

Title `חמ״ל ספקים`, sub `מצב הספקים ביום האירוע. צ׳ק־אין בשטח בלחיצה אחת.`

Filter chips: `הכל` (default), `מאושר`, `בהמתנה` — filter the list by status.

Rows: card surface at radius 20, padding `14px 15px`, flex row, gap 10, align center.
- Name 14.5px/600/-.01em ink; below it `<role> · <time>` 11.5px/400 `#64748B`.
- Status chip: 11px/600, radius 999, padding `5px 10px`, `width: fit-content`, `white-space: nowrap`. `מאושר` → `rgba(15,23,42,.06)` bg, ink text. `בהמתנה` → `rgba(176,141,87,.14)` bg, gold text.
- Check-in button: 32×32, radius 11, `1px rgba(226,232,240,.9)`, `rgba(241,245,249,.7)`, `#94A3B8` 15px check icon at `strokeWidth 1.6`.

| Vendor | Role | Arrival | Status |
| --- | --- | --- | --- |
| לחם ויין | קייטרינג | 16:30 | מאושר |
| אלון מור | דיג׳יי והגברה | 18:00 | מאושר |
| רון כספי | צילום ווידאו | 17:15 | בהמתנה |
| סטודיו לבנדר | עיצוב ופרחים | 14:00 | מאושר |
| Pour | ברמנים | 17:45 | בהמתנה |
| לייטהאוס | תאורה | 13:00 | מאושר |
| דרך המלך | הסעות | 19:30 | מאושר |

### 9. Mobile navigation

Rendered on every route except `landing` and `login`. Three variants (`navPattern` prop):

- **`dock` (default)** — centered floating pill, `bottom: 26px`, icons only (no labels): padding 6, gap 4, radius 999, `rgba(255,255,255,.9)` + `blur(22px)`, `1px rgba(226,232,240,.8)`, shadow `0 22px 45px -22px rgba(15,23,42,.45)`. Items padded `9px 11px`, radius 14.
- **`bottombar`** — full-width bar pinned to the bottom, `padding: 10px 8px 26px` (the 26px is the home-indicator safe area; in production use `padding-bottom: max(26px, env(safe-area-inset-bottom))`), `rgba(255,255,255,.9)` + `blur(22px)`, `1px` top border, `justify-content: space-around`, icons **with** 10px/500 labels.
- **`tabs`** — pinned under the status bar (`top: 52px`), centered pill on `rgba(241,245,249,.9)`; the active item gets a `#fff` pill with `0 1px 3px rgba(15,23,42,.12)`.

Items: `פורטל` (home), `כספת` (moodboard), `בר` (bar), `תקציב` (budget), `ספקים` (vendors). Active ink `#0F172A`, inactive `#94A3B8`, 21px icons at `strokeWidth 1.5`, transition `all .25s ease`.

### 10. Web producer dashboard

Two-column shell, `max-width: 1320px`, gap 18.

**Sidebar** — 236px, glass, radius 26, padding `18px 14px`, gap 6.
- Kicker `מפיק פעיל`, then a white-label brand switcher row: 26×26 radius-9 obsidian monogram `בל`, name `ברק ליור` 13px/600, chevron `#94A3B8`. Row: padding `9px 10px`, radius 14, `rgba(241,245,249,.9)`, `1px rgba(226,232,240,.8)`.
- Nav items (18px icons, 13.5px labels, radius 14, padding `11px 12px`): `סקירת אירוע` (active — 600 weight, `rgba(241,245,249,.95)` fill), `חמ״ל ספקים`, `תקציב ותשלומים`, `אישורי הגעה והושבה`, `כספת השראה`, `מיתוג דינמי`, `Super Admin`.

**Header** — kicker `דשבורד מפיק · 4 אירועים פעילים`; title `נועה ואיתי · 12.03.2027` 32px/800/-.035em. Actions: `ייצוא לו״ז PDF` (42px, radius 14, glass, 1px border) and `משימה חדשה` (obsidian fill, shadow `0 12px 24px -14px rgba(15,23,42,.7)`).

**Segmented control** — pill on glass, padding 4, `width: fit-content`. Options `סקירה` (default), `ספקים`, `תקציב`. Active: obsidian fill, white 600 text; inactive: `#475569` 500. Transition `all .25s ease`. The prototype animates via background swap; a sliding-thumb implementation is welcome as long as timing stays ~.25s ease.

**KPI row** — `grid-template-columns: repeat(4,1fr)`, gap 14, cards radius 22 padding 18 gap 6. Label 11.5px/500 `#94A3B8`, value 27px/700/-.03em nowrap, note 11.5px/500 gold.

| Label | Value | Note |
| --- | --- | --- |
| ימים לאירוע | 200 | 12.03.2027 |
| אישורי הגעה | 218 / 340 (isolated) | 64% אושרו |
| תקציב מנוצל | 49% | ₪111,500 שולם |
| ספקים | 7 | 2 בהמתנה |

**Body** — `grid-template-columns: 1.55fr 1fr`, gap 14, `align-items: start`.
- Left: **vendor table** in a card. Header `חמ״ל ספקים` 15px/600 with `7 ספקים · 2 בהמתנה` 11.5px `#94A3B8`. Columns `1.4fr 1fr .8fr .9fr` — `ספק`, `תחום`, `שעת הגעה`, `סטטוס`. Header row 11px/500 `#94A3B8` with a `1px rgba(226,232,240,.8)` bottom border; data rows `11px 0` with `1px rgba(241,245,249,.9)`. Same seven vendors and status chips as the mobile screen.
- Right column, stacked gap 14:
  - **לו״ז האירוע** — rows gap 11, `7px 0`; time 12px/600 gold in a fixed 44px column; title 13.5px/500 ink; who 11.5px `#94A3B8`.
    `13:00 כניסת תאורה והגברה / לייטהאוס · אלון מור` · `16:30 קייטרינג בשטח / לחם ויין` · `18:00 קבלת פנים / דיג׳יי אלון מור` · `19:30 חופה / רון כספי · צילום` · `20:15 פתיחת בר וריקודים / Pour · ברמנים`
  - **בר ואלכוהול** — bottle count 34px/800/-.04em, caption `בקבוקים ל־240 מוזמנים · עלות משוערת ₪X` (live from the calculator state).

### 11. Prototype-only chrome (do not ship)

The surface switcher (`אפליקציה` / `דשבורד מפיק`), the `עב` / `EN` toggle, the phone bezel, the screen list on the right, and the "וריאציות" note card exist only to demo the design. The language toggle is **designed but not wired** — full LTR mirroring is outstanding work.

## Interactions & Behavior

- Route changes are instant, with a `rise .5s ease` (landing) / `.45s ease` (other screens) entry: `opacity 0 → 1`, `translateY(10px) → 0`.
- OTP: auto-advance on digit entry, auto-retreat on Backspace in an empty cell, focus ring via `box-shadow`.
- Every card that navigates is clickable in full (`תקציב`, `כספת השראה`, `בר ואלכוהול`, `חמ״ל ספקים`).
- Sliders recompute the bar results synchronously; the dashboard bar card and the web bar card read the same derived value.
- Vendor filter chips filter the array in place; no animation.
- Like toggles are optimistic and local.
- Report submit sets a sent flag that swaps the button label and colors; no error state is designed yet.
- Sheets close only on backdrop click. **Missing and worth adding in production:** Escape to close, focus trap, body scroll lock, and a drag-to-dismiss gesture.
- Interactive elements carry `transition: all .2s–.25s ease`. Hover states are not designed for touch surfaces; on the web dashboard add a hover tint from the neutral ramp.
- Responsive: the mobile design is authored at 390×816 inside the bezel and is fluid within it. The web dashboard wraps its header actions but assumes ≥1100px; a tablet breakpoint is not designed.

## State Management

Single component state in the prototype. Suggested production split — server state (event, vendors, budget, RSVP, moodboard) via your data layer; the rest local:

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `route` | enum | `landing` | landing, login, home, mood, bar, budget, vendors |
| `otp` | string[6] | `['','','','','','']` | Plus six input refs for focus control |
| `liked` | Record<number,boolean> | `{2:true,5:true}` | Moodboard tiles |
| `guests` / `hours` / `drinkers` | number | 240 / 5 / 75 | Bar inputs |
| `mix` | enum | `מגוון` | Bar mix |
| `vfilter` | enum | `הכל` | Vendor filter |
| `pal` | number | 0 | Selected palette |
| `seg` | enum | `סקירה` | Web segmented control |
| `sheet` | `null \| 'contact' \| 'report'` | `null` | Bottom sheet |
| `topic` | enum | `לו״ז ותזמון` | Report topic |
| `reportText` | string | `''` | Report body |
| `sent` | boolean | `false` | Report submitted |

Data fetching needed for: event summary (date, venue, task progress), RSVP counts and seating, budget categories with payments, vendor list with statuses and arrival times, moodboard items, run-of-show, and the producer's white-label brand record (name, logo, colors).

**White-label:** the accent is already a token (`accent`, default `#B08D57`, alternates `#64748B`, `#0F172A`, `#8A6E4B`). Drive it from the producer record as a CSS variable so a new producer needs no code change.

## Assets

- **Icons** — outline glyphs at `strokeWidth 1.5` (1.6 on the vendor check). Drawn inline in the prototype as placeholders; replace with **lucide-react** equivalents: `Home`, `Sparkles`, `Wine`/`Martini`, `Wallet`, `Users`, `Calendar`, `Bell`, `Phone`, `MessageCircle`, `AlertTriangle`, `Check`, `ChevronDown`, `BarChart3`, `Palette`.
- **Photography** — every image is an empty drop-target placeholder. The hero and the eight moodboard tiles need real photography. Nothing is licensed or supplied in this bundle.
- **Fonts** — Heebo, Google Fonts, weights 300–800. Self-host in production.
- **Logo** — the `בל` monogram is a text placeholder standing in for the producer's logo.

## Files

| File | What it is |
| --- | --- |
| `Event Platform.dc.html` | Source of truth — template + logic, all values inline |
| `preview-standalone.html` | Compiled offline build; open in a browser or on a phone to interact |

## Open items

1. English locale and full LTR mirroring.
2. RSVP and seating screens, run-of-show editor with PDF export, and the Super Admin surface — named in the brief, not yet designed.
3. Real photography.
4. Sheet accessibility (Escape, focus trap, scroll lock).
5. Error and loading states throughout.
6. Tablet breakpoint for the producer dashboard.
