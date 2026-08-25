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
    base:   '#846941',
    bright: '#A18150',
    line:   '#B08D57',
    light:  '#B08D57',
    wash:   'rgba(176, 141, 87, .07)',
  },
  {
    key: 'olive',
    label: 'זית',
    base:   '#647340',
    bright: '#7B8E4F',
    line:   '#7A8C4E',
    light:  '#7A8C4E',
    wash:   'rgba(122, 140, 78, .07)',
  },
  {
    key: 'clay',
    label: 'טרקוטה',
    base:   '#9D5C3E',
    bright: '#C2724D',
    line:   '#C0714C',
    light:  '#C0714C',
    wash:   'rgba(192, 113, 76, .07)',
  },
  {
    key: 'plum',
    label: 'שזיף',
    base:   '#935888',
    bright: '#B76DA9',
    line:   '#9A5C8E',
    light:  '#A66399',
    wash:   'rgba(154, 92, 142, .07)',
  },
  {
    key: 'teal',
    label: 'טורקיז עמוק',
    base:   '#327772',
    bright: '#3E938D',
    line:   '#3C8F89',
    light:  '#3C8F89',
    wash:   'rgba(60, 143, 137, .07)',
  },
  {
    key: 'graphite',
    label: 'גרפיט',
    base:   '#686C75',
    bright: '#828792',
    line:   '#6B6F78',
    light:  '#767A84',
    wash:   'rgba(107, 111, 120, .07)',
  },
];

/* Gold. The handoff's own accent, and the one the whole Lux direction is
   built around. */
export const DEFAULT_ACCENT = ACCENTS[0];

export const accentByKey = (key: string | null | undefined): Accent =>
  ACCENTS.find((a) => a.key === key) ?? DEFAULT_ACCENT;

/** The custom properties the stylesheet reads. Written as a style attribute
 *  rather than a stylesheet, so it costs no extra request and cannot arrive
 *  after the first paint. */
export function accentVars(a: Accent): Record<string, string> {
  return {
    '--accent': a.base,
    '--accent-bright': a.bright,
    '--accent-line': a.line,
    '--accent-light': a.light,
    '--accent-wash': a.wash,
  };
}
