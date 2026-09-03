/**
 * The colours a producer may paint their diary with.
 *
 * A shortlist rather than a colour wheel, for the reason the accent is a
 * shortlist: every tone here was picked to carry a label on the ivory ground
 * and to stay apart from its neighbours at the size a diary chip is actually
 * read. A free picker hands somebody a yellow that vanishes on white, and
 * they find out on the morning they are scanning for a tasting.
 *
 * Ten is the ceiling on purpose. A taxonomy nobody can hold in their head is
 * a taxonomy nobody uses, and eleven colours in a legend is a legend.
 *
 * A plain module: the server action validates against it and the client
 * renders it, and a `'use server'` file may export nothing but async
 * functions.
 */

export type Swatch = { hex: string; label: string };

export const PALETTE: Swatch[] = [
  { hex: '#2F6F5E', label: 'ירוק' },
  { hex: '#7C5CBF', label: 'סגול' },
  { hex: '#C2762B', label: 'כתום' },
  { hex: '#2563EB', label: 'כחול' },
  { hex: '#B03A5B', label: 'ורוד עמוק' },
  { hex: '#0E7490', label: 'טורקיז' },
  { hex: '#826840', label: 'זהב' },
  { hex: '#9333EA', label: 'לילך' },
  { hex: '#B45309', label: 'ענבר' },
  { hex: '#475569', label: 'אפור' },
];

const KNOWN = new Set(PALETTE.map((s) => s.hex.toLowerCase()));

/** A colour off the shortlist, or the neutral. Never a refusal: a mangled
 *  hex should not stop somebody naming a tag. */
export const safeColor = (raw: string): string => {
  const hex = String(raw ?? '').trim().toLowerCase();
  return KNOWN.has(hex) ? hex.toUpperCase() : '#475569';
};
