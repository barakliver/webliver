/**
 * The accents a producer may choose from.
 *
 * A colour picker was the obvious thing to build and the wrong one. Every tone
 * in this palette was measured rather than judged by eye, and three of them
 * were darkened on the way in from the design handoff because the measurement
 * said so and all three looked fine. A free hex field hands a producer the
 * ability to make their own couples' text unreadable, and neither of them
 * would find out by looking at it.
 *
 * So the choice is a shortlist, and every entry has four worked-out roles
 * rather than one hue. scripts/check-contrast.mjs iterates this file and fails
 * the build rather than shipping a tone somebody cannot read.
 *
 * The whole set is recomputed whenever the ground moves. A tone that clears
 * 4.5:1 on one ground does not automatically clear it on another, and quietly
 * carrying the old numbers over is how a palette stops meaning anything — the
 * move back to warm took clay under the bar and the checker caught it.
 *
 * Four roles:
 *   base    safe for words at any size. Solved against its own wash, which is
 *           the darkest ground it ever sits on: solving against ivory alone
 *           leaves it at exactly 4.5 there and under it everywhere else
 *   bright  large serif numerals only, 24px and up, where 3:1 is the bar
 *   line    hairlines and rules. Decoration, never carrying meaning alone
 *   light   on the dark ground only, where the ratios invert
 *   night   the accent on the dark palette, solved against its step up
 */

/** The page's own ground, which the browser chrome continues on the
 *  platform's address, and which every accent above is solved against. Left
 *  behind by a palette change twice now — the second time it was still naming
 *  a slate ground while the page had gone warm, so the six white-label tones
 *  were being checked against a colour nobody could see any more. Moved a
 *  third time when the ground became a pale blue; every tone below was
 *  re-measured against it and all six survived unchanged, because the new
 *  ground is lighter than the ivory and a lighter ground is kinder to dark
 *  text than a darker one. And then, a fourth time, white: HoneyBook's
 *  ground, which this had stopped matching two palettes ago. And a fifth
 *  time, powder blush, for the plum design. And a sixth, the camel coat
 *  thinned toward paper, for the palette card he sent: five of the six `base`
 *  tones moved one to three percent darker, because the ground is a little
 *  darker than the blush was and a wash over it darker still. */
export const PAGE_GROUND = '#F3EDE4';

export type Accent = {
  key: string;
  label: string;
  base: string;
  bright: string;
  line: string;
  light: string;
  /** On the dark palette, where the ratios invert again. `light` was solved
   *  against the one dark band this product used to have, #1D1E20, and four
   *  of the six fall under 4.5:1 on the card and the step up of the dark
   *  palette, which are lighter grounds than that band was. The checker
   *  found all four. Lowering those grounds far enough would have flattened
   *  the canvas, the card and the step up into one tone, so the tone moves
   *  instead of the ground. */
  night: string;
  wash: string;
};

/* The three `light` tones moved by one and two percent when the contrast
   script stopped measuring a palette from two redesigns ago. Olive, clay and
   graphite were 4.41, 4.42 and 4.47 on the dark ground against a bar of 4.5,
   and they had been for as long as the ground has been #192030 — the check
   was reading the ivory era's #1E1C18 and reporting that they passed. None
   of the three is a different colour now; each is the same colour clearing
   the bar it was always meant to clear. */
/* And five of the six `night` tones moved by two to three percent when the
   dark step up went from the warm #2A2621 to HoneyBook's cooler and lighter
   #25353C: each read 4.1 on it against a bar of 4.5. Teal was already
   clear. Then the plum design moved them again, and four `light` tones
   with them: the plum step up #45373E and the plum band #2B2228 are warmer
   and a touch lighter than the slate they replaced, and each tone moved the
   two to four percent that clears 4.5 on them. Teal cleared both as it was. */
export const ACCENTS: Accent[] = [
  {
    key: 'gold',
    label: 'זהב',
    base:   '#7C633D',
    bright: '#9E7F4E',
    line:   '#B08D57',
    light:  '#B08D57',
    night:  '#BEA073',
    wash:   'rgba(176, 141, 87, .07)',
  },
  {
    key: 'olive',
    label: 'זית',
    base:   '#5E6C3C',
    bright: '#7B8E4F',
    line:   '#7A8C4E',
    light:  '#809255',
    night:  '#9DAA7B',
    wash:   'rgba(122, 140, 78, .07)',
  },
  {
    key: 'clay',
    label: 'טרקוטה',
    /* 4.70:1 on its own wash. It was #9B5B3D, which solved to 4.499 — under
       the bar by a thousandth, and it had been sitting there passing on a
       rounded display. The warmer ground made the wash lighter and the
       rounding stopped hiding it. */
    base:   '#955638',
    bright: '#C2724D',
    line:   '#C0714C',
    light:  '#C47854',
    night:  '#D2987C',
    wash:   'rgba(192, 113, 76, .07)',
  },
  {
    key: 'plum',
    label: 'שזיף',
    base:   '#8A5380',
    bright: '#B76DA9',
    line:   '#9A5C8E',
    light:  '#AE7CA4',
    night:  '#BF99B8',
    wash:   'rgba(154, 92, 142, .07)',
  },
  {
    key: 'teal',
    label: 'טורקיז עמוק',
    base:   '#205757',
    bright: '#2E7676',
    line:   '#5E9F9B',
    light:  '#8FC4C1',
    night:  '#8FC4C1',
    wash:   'rgba(32, 87, 87, .08)',
  },
  {
    key: 'graphite',
    label: 'גרפיט',
    base:   '#62666E',
    bright: '#828792',
    line:   '#6B6F78',
    light:  '#888B93',
    night:  '#A3A5AB',
    wash:   'rgba(107, 111, 120, .07)',
  },
];

/* Gold. The handoff's own accent, and the one the whole Lux direction is
   built around. */
export const DEFAULT_ACCENT = ACCENTS[0];

export const accentByKey = (key: string | null | undefined): Accent =>
  ACCENTS.find((a) => a.key === key) ?? DEFAULT_ACCENT;

/** A hex tone as the three bare channels Tailwind needs.
 *
 *  The presets above stay hex because a person reads and a contrast script
 *  measures them, and `#846941` is a colour where `132 105 65` is arithmetic.
 *  The conversion happens here, at the one boundary that cares.
 *
 *  It has to be channels on the other side of that boundary. A custom
 *  property holding a whole colour cannot take a Tailwind opacity modifier:
 *  `border-accent/40` against `var(--accent)` compiles to no declaration at
 *  all, so the hover border a producer's brand was supposed to tint simply
 *  never appeared. */
const channels = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** The custom properties the stylesheet reads. Written as a style attribute
 *  rather than a stylesheet, so it costs no extra request and cannot arrive
 *  after the first paint.
 *
 *  Both forms are written: the channels Tailwind classes resolve through, and
 *  the whole colour that a gradient stop, an `accent-color` or an SVG fill
 *  needs. The whole ones are derived from the channels rather than passed
 *  separately, so the two cannot drift apart. */
/** The pressed fill: the same hue, a fifth darker. */
export function darker(hex: string, by = 0.2): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - by))).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

export function accentVars(a: Accent): Record<string, string> {
  return {
    '--accent-rgb': channels(a.base),
    '--accent-hover-rgb': channels(darker(a.base)),
    '--accent-bright-rgb': channels(a.bright),
    '--accent-line-rgb': channels(a.line),
    '--accent-light-rgb': channels(a.light),
    '--accent-night-rgb': channels(a.night),

    '--accent': `rgb(${channels(a.base)})`,
    '--accent-hover': `rgb(${channels(darker(a.base))})`,
    '--accent-bright': `rgb(${channels(a.bright)})`,
    '--accent-line': `rgb(${channels(a.line)})`,
    '--accent-light': `rgb(${channels(a.light)})`,
    '--accent-night': `rgb(${channels(a.night)})`,
    /* Translucent by definition, so it stays whole. */
    '--accent-wash': a.wash,
  };
}
