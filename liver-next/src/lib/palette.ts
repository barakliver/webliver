import { PALETTE_ROLES, type PaletteRole, type Swatch } from '../content/brandKit.ts';

/**
 * Five colours from a board of photographs, each with a job.
 *
 * The browser reads the pixels off the couple's images and hands them here;
 * this file does the arithmetic and knows nothing about a canvas, so it can
 * be tested with a handful of numbers. K-means over the sampled pixels
 * finds the colours that are actually there; the roles are then handed out
 * by what a printed piece needs: the lightest for the paper, the darkest for
 * the ink, the most saturated of the rest for the accent, the most present
 * for the primary, and what is left for the secondary.
 *
 * Deterministic on purpose: the seeds are spread through the sample rather
 * than drawn at random, so the same board reads the same way twice.
 */

export type Rgb = [number, number, number];

const dist = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export const toHex = (c: Rgb): string =>
  '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

export const fromHex = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Perceived lightness, 0 to 1. */
export const lightness = (c: Rgb) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

/** How far from grey, 0 to 1. */
export const saturation = (c: Rgb) => {
  const max = Math.max(...c), min = Math.min(...c);
  return max === 0 ? 0 : (max - min) / max;
};

/** The k most present colours in a sample, with how much of the sample each
 *  one owns. `pixels` is a flat RGB list (no alpha). Pixels that are almost
 *  white or almost black are kept: they are the paper and the ink. */
export function quantize(pixels: ArrayLike<number>, k = 5, rounds = 12): { color: Rgb; share: number }[] {
  const pts: Rgb[] = [];
  for (let i = 0; i + 2 < pixels.length; i += 3) pts.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  if (pts.length === 0) return [];
  const kk = Math.min(k, pts.length);

  /* Farthest-point seeding: the darkest pixel first, then each next seed is
     the pixel farthest from every seed so far. A small colour that is very
     different (the one gold ribbon on a green board) gets its own seed
     rather than being folded into the nearest big one, and the same board
     seeds the same way twice. */
  let darkest = 0;
  for (let i = 1; i < pts.length; i++) if (lightness(pts[i]) < lightness(pts[darkest])) darkest = i;
  let centers: Rgb[] = [[...pts[darkest]] as Rgb];
  const nearest = new Array<number>(pts.length).fill(Infinity);
  while (centers.length < kk) {
    const last = centers[centers.length - 1];
    let far = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = dist(pts[i], last);
      if (d < nearest[i]) nearest[i] = d;
      if (nearest[i] > nearest[far]) far = i;
    }
    centers.push([...pts[far]] as Rgb);
  }

  let owner = new Array<number>(pts.length).fill(0);
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < kk; c++) {
        const d = dist(pts[i], centers[c]);
        if (d < bd) { bd = d; best = c; }
      }
      if (owner[i] !== best) { owner[i] = best; moved = true; }
    }
    const sums: number[][] = centers.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const s = sums[owner[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    centers = centers.map((c, i) => (sums[i][3] === 0 ? c : [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]]));
    if (!moved) break;
  }

  const counts = centers.map((_, c) => owner.filter((o) => o === c).length);
  return centers
    .map((color, i) => ({ color: color.map(Math.round) as Rgb, share: counts[i] / pts.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** Hands the five roles out. Fewer than five colours still yields five
 *  swatches: a role with nothing left to take is filled from the nearest
 *  sensible neighbour rather than left empty. */
export function assignRoles(found: { color: Rgb; share: number }[]): Swatch[] {
  const pool = [...found];
  const take = (pick: (c: { color: Rgb; share: number }[]) => number): Rgb | null => {
    if (pool.length === 0) return null;
    const i = pick(pool);
    return pool.splice(i, 1)[0].color;
  };
  const argmax = (f: (c: { color: Rgb; share: number }) => number) => (c: { color: Rgb; share: number }[]) =>
    c.reduce((bi, x, i, arr) => (f(x) > f(arr[bi]) ? i : bi), 0);

  const light = take(argmax((c) => lightness(c.color)));
  const dark = take(argmax((c) => -lightness(c.color)));
  const accent = take(argmax((c) => saturation(c.color)));
  const primary = take(argmax((c) => c.share));
  const secondary = take(argmax((c) => c.share));

  const byRole: Record<PaletteRole, Rgb | null> = { primary, secondary, accent, light, dark };
  /* Paper that is not actually light, or ink that is not dark, is pushed
     to where a printer needs it; the reading keeps its hue. */
  if (byRole.light && lightness(byRole.light) < 0.8) byRole.light = lift(byRole.light, 0.92);
  if (byRole.dark && lightness(byRole.dark) > 0.25) byRole.dark = lift(byRole.dark, 0.12);
  if (!byRole.light) byRole.light = [250, 246, 239];
  if (!byRole.dark) byRole.dark = [31, 27, 23];
  if (!byRole.primary) byRole.primary = byRole.dark;
  if (!byRole.accent) byRole.accent = byRole.primary;
  if (!byRole.secondary) byRole.secondary = mix(byRole.primary, byRole.light, 0.6);

  return PALETTE_ROLES.map((role) => ({ role, hex: toHex(byRole[role]!), name: '' }));
}

/** The same hue at a chosen lightness. */
function lift(c: Rgb, target: number): Rgb {
  const l = lightness(c);
  if (l === 0) return [target * 255, target * 255, target * 255];
  const f = target / l;
  const scaled = c.map((v) => v * f) as Rgb;
  const over = Math.max(...scaled) - 255;
  return over > 0 ? (scaled.map((v) => Math.min(255, v + over * 0.5)) as Rgb) : scaled;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** From sampled pixels to a named-by-role palette in one call. */
export const paletteFrom = (pixels: ArrayLike<number>): Swatch[] => assignRoles(quantize(pixels, 6));
