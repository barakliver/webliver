/**
 * The wedding's own brand, as a shape.
 *
 * Read off the couple's inspiration board once, then everything printed or
 * published for that wedding is built from it: five colours with a role
 * each, one pairing of typefaces, three words, the motifs that repeat, a
 * voice, and which of the two options was picked for each piece. This file
 * is the shape and the fixed lists; it imports nothing so the tests and the
 * browser can both read it.
 */

export const PALETTE_ROLES = ['primary', 'secondary', 'accent', 'light', 'dark'] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

export type Swatch = { role: PaletteRole; hex: string; name: string };

/* ── typefaces ───────────────────────────────────────────────────────────────
   Every pairing here sets Hebrew. A wedding in this country is invited in
   Hebrew, and a beautiful Latin serif that falls back to the system font for
   the names is the single most common way a printed invitation goes wrong.
   Each pairing is a display face for the names and the headings and a text
   face for everything else, both on Google Fonts, both with a Hebrew subset.
   The Latin faces sit beside them so an English name is set on purpose. */
export const FONT_PAIRS = [
  { key: 'frank-heebo',      display: 'Frank Ruhl Libre', body: 'Heebo',     serif: true,  feel: 'classic' },
  { key: 'david-assistant',  display: 'David Libre',      body: 'Assistant', serif: true,  feel: 'soft' },
  { key: 'bellefair-rubik',  display: 'Bellefair',        body: 'Rubik',     serif: true,  feel: 'romantic' },
  { key: 'noto-assistant',   display: 'Noto Serif Hebrew', body: 'Assistant', serif: true, feel: 'formal' },
  { key: 'suez-heebo',       display: 'Suez One',         body: 'Heebo',     serif: true,  feel: 'bold' },
  { key: 'amatic-assistant', display: 'Amatic SC',        body: 'Assistant', serif: false, feel: 'playful' },
  { key: 'secular-heebo',    display: 'Secular One',      body: 'Heebo',     serif: false, feel: 'modern' },
] as const;
export type FontPairKey = (typeof FONT_PAIRS)[number]['key'];
export const FONT_PAIR_KEYS = FONT_PAIRS.map((p) => p.key) as FontPairKey[];

export const fontPair = (key: string) =>
  FONT_PAIRS.find((p) => p.key === key) ?? FONT_PAIRS[0];

/** The one stylesheet that loads a pairing, from the host the browser
 *  already trusts for fonts. Weights kept to what the pieces use. */
export function fontHref(key: string): string {
  const p = fontPair(key);
  const fam = (name: string, weights: string) =>
    `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@${weights}`;
  return `https://fonts.googleapis.com/css2?${fam(p.display, '400;700')}&${fam(p.body, '300;400;600')}&display=swap`;
}

/* ── the pieces ─────────────────────────────────────────────────────────────
   Trim sizes in millimetres, portrait. The print route adds the bleed.
   `pages` is what one print run produces: the save-the-date has a back,
   the table cards print one per table. The website is a screen. */
export const PIECES = [
  { key: 'savedate', w: 127, h: 178, pages: 'two' },
  { key: 'invite',   w: 127, h: 178, pages: 'one' },
  { key: 'rsvp',     w: 89,  h: 127, pages: 'one' },
  { key: 'details',  w: 102, h: 229, pages: 'one' },
  { key: 'menu',     w: 102, h: 229, pages: 'one' },
  { key: 'table',    w: 127, h: 178, pages: 'tables' },
  { key: 'welcome',  w: 457, h: 610, pages: 'one' },
  { key: 'program',  w: 102, h: 229, pages: 'one' },
  { key: 'website',  w: 390, h: 844, pages: 'screen' },
] as const;
export type PieceKey = (typeof PIECES)[number]['key'];
export const PIECE_KEYS = PIECES.map((p) => p.key) as PieceKey[];
export const pieceOf = (key: string) => PIECES.find((p) => p.key === key) ?? null;

/** Bleed on every printed edge, and the length of a crop mark. */
export const BLEED_MM = 3;
export const MARK_MM = 5;

export type Variant = 'safe' | 'bold';

export type BrandTexts = {
  story: string;
  travel: string;
  registry: string;
  /** One course per line. */
  menu: string;
};

export type WeddingBrand = {
  palette: Swatch[];
  fonts: FontPairKey;
  words: string[];
  motifs: string[];
  voice: string;
  /** Which direction won on the board and why, in the director's words. */
  direction: string;
  /** Which of the two options the board leans to, and why. */
  lean: Variant;
  leanReason: string;
  picks: Partial<Record<PieceKey, Variant>>;
  texts: BrandTexts;
  inputs: { words: string; reference: string; colorsIn: string; colorsOut: string };
  /** 'ai' when the board was read by the model, 'hand' when typed. */
  by: 'ai' | 'hand' | '';
  at: string;
};

/* A quiet default so a wedding with no reading yet still has something to
   draw the pieces with: warm ivory, a deep green, a dusty gold. */
export const DEFAULT_PALETTE: Swatch[] = [
  { role: 'primary',   hex: '#2F4A3E', name: 'ירוק עמוק' },
  { role: 'secondary', hex: '#D9C3A5', name: 'חול' },
  { role: 'accent',    hex: '#B08D57', name: 'זהב עמום' },
  { role: 'light',     hex: '#FAF6EF', name: 'שנהב' },
  { role: 'dark',      hex: '#1F1B17', name: 'פחם חם' },
];

export const emptyTexts = (): BrandTexts => ({ story: '', travel: '', registry: '', menu: '' });

export const defaultBrand = (): WeddingBrand => ({
  palette: DEFAULT_PALETTE.map((s) => ({ ...s })),
  fonts: 'frank-heebo',
  words: [],
  motifs: [],
  voice: '',
  direction: '',
  lean: 'safe',
  leanReason: '',
  picks: {},
  texts: emptyTexts(),
  inputs: { words: '', reference: '', colorsIn: '', colorsOut: '' },
  by: '',
  at: '',
});

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.slice(0, max) : '');
const strList = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 60)).slice(0, max) : [];

/** The column as the application reads it, whatever the database sent.
 *  Every field is checked; a palette with a colour missing gets that role
 *  from the default rather than a hole the pieces cannot draw with. */
export function readBrand(raw: unknown): WeddingBrand | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out = defaultBrand();

  const pal = Array.isArray(r.palette) ? (r.palette as unknown[]) : [];
  out.palette = PALETTE_ROLES.map((role) => {
    const found = pal.find((s) => s && typeof s === 'object' && (s as Swatch).role === role) as Partial<Swatch> | undefined;
    const fallback = DEFAULT_PALETTE.find((s) => s.role === role)!;
    return {
      role,
      hex: isHex(found?.hex) ? found!.hex.toUpperCase() : fallback.hex,
      name: str(found?.name, 40) || fallback.name,
    };
  });

  out.fonts = (FONT_PAIR_KEYS as string[]).includes(String(r.fonts)) ? (r.fonts as FontPairKey) : 'frank-heebo';
  out.words = strList(r.words, 3);
  out.motifs = strList(r.motifs, 4);
  out.voice = str(r.voice);
  out.direction = str(r.direction, 900);
  out.lean = r.lean === 'bold' ? 'bold' : 'safe';
  out.leanReason = str(r.leanReason);

  const picks = r.picks && typeof r.picks === 'object' ? (r.picks as Record<string, unknown>) : {};
  for (const k of PIECE_KEYS) {
    const v = picks[k];
    if (v === 'safe' || v === 'bold') out.picks[k] = v;
  }

  const t = r.texts && typeof r.texts === 'object' ? (r.texts as Record<string, unknown>) : {};
  out.texts = { story: str(t.story, 1200), travel: str(t.travel, 600), registry: str(t.registry, 400), menu: str(t.menu, 600) };

  const i = r.inputs && typeof r.inputs === 'object' ? (r.inputs as Record<string, unknown>) : {};
  out.inputs = { words: str(i.words, 120), reference: str(i.reference, 80), colorsIn: str(i.colorsIn, 120), colorsOut: str(i.colorsOut, 120) };

  out.by = r.by === 'ai' ? 'ai' : r.by === 'hand' ? 'hand' : '';
  out.at = str(r.at, 40);
  return out;
}

export const swatch = (b: WeddingBrand, role: PaletteRole): string =>
  b.palette.find((s) => s.role === role)?.hex ?? DEFAULT_PALETTE.find((s) => s.role === role)!.hex;

/** The option in force for a piece: the pick, else the board's lean. */
export const variantFor = (b: WeddingBrand, piece: PieceKey): Variant => b.picks[piece] ?? b.lean;

/** The menu as lines, blank ones dropped. */
export const menuLines = (b: WeddingBrand): string[] =>
  b.texts.menu.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12);

/** Relative luminance of a hex colour, 0 black to 1 white. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/** Which of the two neutrals reads on a ground: the light one on a dark
 *  ground, the dark one on a light ground. */
export const inkOn = (b: WeddingBrand, groundHex: string): string =>
  luminance(groundHex) > 0.4 ? swatch(b, 'dark') : swatch(b, 'light');

/** "נועה ואיתי" as two names, or the whole thing as one when it does not
 *  split cleanly. The joining vav is the one convention the platform can
 *  rely on; a name written any other way is set as it was typed. */
export function splitNames(display: string): [string, string] | [string] {
  const m = display.trim().match(/^(.{2,30}?)\s+ו(.{2,30})$/);
  if (m) return [m[1].trim(), m[2].trim()];
  const and = display.split(/\s+(?:and|&)\s+/i);
  if (and.length === 2) return [and[0].trim(), and[1].trim()];
  return [display.trim()];
}

/* ── the guests' page in the brand ──────────────────────────────────────────
   The page is styled through the platform's tokens, so the brand reaches it
   by redefining the tokens on the page's own element: channels rather than
   hex, because that is what the classes read, and the two soft tones
   flattened over the paper the way the moodboard flattens its own. */
const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const mixHex = (a: string, b: string, t: number) => {
  const x = channels(a), y = channels(b);
  return x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(' ');
};

export function brandVars(b: WeddingBrand): Record<string, string> {
  const f = fontPair(b.fonts);
  const light = swatch(b, 'light'), dark = swatch(b, 'dark'), accent = swatch(b, 'accent');
  return {
    '--surface-rgb': channels(light).join(' '),
    '--surface-100-rgb': mixHex(light, '#FFFFFF', 0.5),
    '--surface-200-rgb': mixHex(light, dark, 0.06),
    '--ink-rgb': channels(dark).join(' '),
    '--ink-soft-rgb': mixHex(dark, light, 0.3),
    '--ink-mute-rgb': mixHex(dark, light, 0.42),
    '--accent-rgb': channels(accent).join(' '),
    '--accent-bright-rgb': channels(accent).join(' '),
    '--line': `rgba(${channels(dark).join(',')}, .12)`,
    '--line-strong': `rgba(${channels(dark).join(',')}, .22)`,
    '--font-assistant': `'${f.display}'`,
    '--font-frank': `'${f.display}'`,
    '--font-heebo': `'${f.body}'`,
  };
}
