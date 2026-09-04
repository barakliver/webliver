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

/* The two label colours, which are the palette's own ink and ground. Written
   out rather than read from a token because this runs where CSS custom
   properties do not exist: it decides a value, it does not paint one. */
const LABEL_LIGHT = '#F7F4EE';
const LABEL_DARK = '#171512';

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * What to write on a swatch.
 *
 * The tag chip used the light ink on every colour, on the assumption that a
 * producer's chosen colour is dark. Nine of the ten are; the orange is not,
 * and the accessibility audit found exactly that chip at 3.23:1 — a label
 * somebody has to lean in to read, on the one control whose whole job is
 * being recognised at a glance.
 *
 * Measured rather than listed, so a colour added to the shortlist tomorrow
 * gets the right answer without anybody remembering this exists.
 */
export const labelOn = (hex: string): string =>
  contrast(LABEL_LIGHT, hex) >= contrast(LABEL_DARK, hex) ? LABEL_LIGHT : LABEL_DARK;
