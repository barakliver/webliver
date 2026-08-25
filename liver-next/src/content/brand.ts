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
 * The whole set was recomputed when the ground changed from cool white to
 * ivory. A tone that clears 4.5:1 on #F3F6FA does not automatically clear it
 * on #FAF7F2, and quietly carrying the old numbers over is how a palette stops
 * meaning anything.
 *
 * Four roles:
 *   base    safe for words at any size. Solved against its own wash, which is
 *           the darkest ground it ever sits on: solving against ivory alone
 *           leaves it at exactly 4.5 there and under it everywhere else
 *   bright  large serif numerals only, 24px and up, where 3:1 is the bar
 *   line    hairlines and rules. Decoration, never carrying meaning alone
 *   light   on the dark ground only, where the ratios invert
 */

export type Accent = {
  key: string;
  label: string;
  base: string;
  bright: string;
  line: string;
  light: string;
  wash: string;
};

export const ACCENTS: Accent[] = [
  {
    key: 'gold',
    label: 'זהב',
    base:   '#816740',
    bright: '#9E7F4E',
    line:   '#B08D57',
    light:  '#B08D57',
    wash:   'rgba(176, 141, 87, .07)',
  },
  {
    key: 'olive',
    label: 'זית',
    base:   '#62713F',
    bright: '#7B8E4F',
    line:   '#7A8C4E',
    light:  '#7A8C4E',
    wash:   'rgba(122, 140, 78, .07)',
  },
  {
    key: 'clay',
    label: 'טרקוטה',
    base:   '#9B5B3D',
    bright: '#C2724D',
    line:   '#C0714C',
    light:  '#C0714C',
    wash:   'rgba(192, 113, 76, .07)',
  },
  {
    key: 'plum',
    label: 'שזיף',
    base:   '#905685',
    bright: '#B76DA9',
    line:   '#9A5C8E',
    light:  '#AA6B9E',
    wash:   'rgba(154, 92, 142, .07)',
  },
  {
    key: 'teal',
    label: 'טורקיז עמוק',
    base:   '#317570',
    bright: '#3E938D',
    line:   '#3C8F89',
    light:  '#3C8F89',
    wash:   'rgba(60, 143, 137, .07)',
  },
  {
    key: 'graphite',
    label: 'גרפיט',
    base:   '#63676F',
    bright: '#828792',
    line:   '#6B6F78',
    light:  '#7D818A',
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
export function accentVars(a: Accent): Record<string, string> {
  return {
    '--accent-rgb': channels(a.base),
    '--accent-bright-rgb': channels(a.bright),
    '--accent-line-rgb': channels(a.line),
    '--accent-light-rgb': channels(a.light),

    '--accent': `rgb(${channels(a.base)})`,
    '--accent-bright': `rgb(${channels(a.bright)})`,
    '--accent-line': `rgb(${channels(a.line)})`,
    '--accent-light': `rgb(${channels(a.light)})`,
    /* Translucent by definition, so it stays whole. */
    '--accent-wash': a.wash,
  };
}
