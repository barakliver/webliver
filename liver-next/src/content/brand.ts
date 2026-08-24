/**
 * The accents a producer may choose from.
 *
 * A colour picker was the obvious thing to build and the wrong one. The whole
 * palette in this app was measured rather than judged by eye, and two tones
 * were darkened on the way in because the measurement said so and they looked
 * fine. Handing a producer a free hex field hands them the ability to make
 * their own couples' text unreadable, and neither of them would find out from
 * looking at it.
 *
 * So the choice is a shortlist. Every entry here has all four roles worked out
 * and every pairing checked by scripts/check-contrast.mjs, which iterates this
 * file — a preset cannot ship without passing.
 *
 * Four roles, the same split the base palette uses:
 *   base   safe for words, 4.5:1 on the ground and on a card
 *   soft   borders and rings, 3:1
 *   bright decoration only, never words
 *   wash   a background, only ever sat on by `base`
 */

export type Accent = {
  key: string;
  label: string;
  base: string;
  soft: string;
  bright: string;
  wash: string;
};

export const ACCENTS: Accent[] = [
  {
    key: 'slate',
    label: 'כחול־אפור',
    base: '#2E5F8C', soft: '#4A80B0', bright: '#4C8BC4', wash: '#E9F0F8',
  },
  {
    key: 'olive',
    label: 'זית',
    base: '#4A6136', soft: '#6B8752', bright: '#6E8B52', wash: '#EDF1E7',
  },
  {
    key: 'clay',
    label: 'טרקוטה',
    base: '#8F4A32', soft: '#B26A4E', bright: '#C07A5C', wash: '#F8ECE7',
  },
  {
    key: 'plum',
    label: 'שזיף',
    base: '#6B3A63', soft: '#8E5885', bright: '#9C6392', wash: '#F3EAF2',
  },
  {
    key: 'teal',
    label: 'טורקיז עמוק',
    base: '#1F6360', soft: '#3D8480', bright: '#45938E', wash: '#E5F1F0',
  },
  {
    key: 'ink',
    label: 'גרפיט',
    base: '#3A4453', soft: '#5C6878', bright: '#697687', wash: '#EDEFF3',
  },
];

export const DEFAULT_ACCENT = ACCENTS[0];

export const accentByKey = (key: string | null | undefined): Accent =>
  ACCENTS.find((a) => a.key === key) ?? DEFAULT_ACCENT;

/** The custom properties the stylesheet reads. Written as a style attribute
 *  rather than a stylesheet, so it costs no extra request and cannot arrive
 *  after the first paint. */
export function accentVars(a: Accent): Record<string, string> {
  return {
    '--accent': a.base,
    '--accent-soft': a.soft,
    '--accent-bright': a.bright,
    '--accent-wash': a.wash,
  };
}
