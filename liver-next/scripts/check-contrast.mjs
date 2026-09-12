/**
 * The palette, measured rather than judged by eye.
 *
 * Every pairing the interface actually renders is listed here with the ratio
 * it has to clear, and the script exits non-zero if one drops under. It is not
 * decoration: two tones in this palette were darkened on the way in because
 * this said so, and both of them looked fine.
 *
 * The targets are WCAG AA. 4.5:1 for anything that is words, 3:1 for a border
 * or a ring that carries meaning, and a low bar for hairlines, which are meant
 * to be barely there and only have to be there at all.
 *
 *     node scripts/check-contrast.mjs
 *
 * The values are duplicated from tailwind.config.ts on purpose: reading them
 * out of the config would mean this passes whenever the config is
 * self-consistent, which is not the question being asked.
 */

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => {
  const [hi, lo] = [L(a), L(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/* The palette. A pale blue ground with a cool near-black on it, and the deep
   teal as the action. The marked values are darker than the design's own,
   because the design's fail the text they are used for on this ground.

   These are copied from globals.css on purpose rather than read out of it.
   Reading them would mean this file passes whenever the stylesheet is
   self-consistent, which is not the question being asked: the question is
   whether the numbers somebody wrote down are the numbers that are readable.
   The cost of the copy is that a palette change has to be made twice, and
   that cost is the point — it is the second pair of eyes. */
const c = {
  ink: '#23272E', inkSoft: '#5A616B', inkMid: '#838A94',
  inkMute: '#565D67',              /* solved against the step up */
  surface: '#F2F6FC', surface100: '#FBFCFF', surface200: '#E4EBF4',
  card: '#FBFCFF',
  dark: '#1B1E22',
  line: '#DCE3EB', lineStrong: '#C4CEDA',
  lineControl: '#7E8794',
  accent: '#205757',               /* the primary action, safe as words */
  accentHover: '#174444',
  accentBright: '#2E7676',         /* large numerals only, 3:1 bar   */
  accentLine: '#5E9F9B',           /* words on the dark ground       */
  accentLight: '#8FC4C1',
  /* The teal at 8% over the canvas, which is what --accent-wash ships. */
  accentWash: '#E1E9EF',
  ok: '#285A3F', okWash: '#E8F0EB',
  warn: '#78520F', warnWash: '#F7F0DC',
  bad: '#953D35', badWash: '#F8E8E7',
  white: '#FFFFFF',
};

/* The hairlines are rgba over the ground; flatten them so the ratio is real. */
const over = (rgba, ground) => {
  const m = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) return rgba;
  const a = parseFloat(m[4]);
  const g = parseInt(ground.slice(1), 16);
  const mix = (fg, bg) => Math.round(fg * a + bg * (1 - a));
  return '#' + [
    mix(+m[1], (g >> 16) & 255), mix(+m[2], (g >> 8) & 255), mix(+m[3], g & 255),
  ].map((v) => v.toString(16).padStart(2, '0')).join('');
};

const checks = [
  ['body text on the ground',      c.ink,        c.surface,     4.5],
  ['body text on the bright ground', c.ink,      c.card,        4.5],
  ['secondary text',               c.inkSoft,    c.surface,     4.5],
  ['secondary on the bright ground', c.inkSoft,  c.card,        4.5],
  ['mid ink, large text only',     c.inkMid,     c.surface,     3.0],
  ['kickers and meta',             c.inkMute,    c.surface,     4.5],
  ['kickers on the bright ground', c.inkMute,    c.card,        4.5],
  ['kickers on the step above',    c.inkMute,    c.surface200,  4.5],
  ['accent as words, on ground',   c.accent,     c.surface,     4.5],
  ['accent as words, on bright',   c.accent,     c.card,        4.5],
  ['accent on its own wash',       c.accent,     c.accentWash,  4.5],
  /* The step up. This pairing was missing and the accessibility audit found
     what the gap let through: a timestamp in the accent inside a message
     bubble, which is drawn on this ground, at 4.47:1. Every ground a tone can
     land on has to be listed, or the list is an opinion rather than a check. */
  ['accent on the step up',        c.accent,     c.surface200,  4.5],
  ['bright accent, numerals only', c.accentBright, c.surface200, 3.0],
  ['good, on its wash',            c.ok,         c.okWash,      4.5],
  ['waiting, on its wash',         c.warn,       c.warnWash,    4.5],
  ['wrong, on its wash',           c.bad,        c.badWash,     4.5],
  /* A label on a filled control. There is no white in this palette, so the
     ivory is the label everywhere a fill carries one, and every fill the
     product actually uses is checked rather than assumed. */
  ['a button label on ink',        c.surface,    c.ink,         4.5],
  ['a label on good',              c.surface,    c.ok,          4.5],
  ['a label on waiting',           c.surface,    c.warn,        4.5],
  ['a label on wrong',             c.surface,    c.bad,         4.5],
  ['a label on the accent',        c.surface,    c.accent,      4.5],
  ['a white label on the accent',  c.white,      c.accent,      4.5],
  ['a white label on the pressed accent', c.white, c.accentHover, 4.5],
  /* The dark ground: Bride Mode, the bar result panel, the site CTA band.
     Gold becomes a text colour here, which is why it is checked at 4.5. */
  ['body on the dark ground',      c.surface,    c.dark,        4.5],
  ['gold as words, on dark',       c.accentLine, c.dark,        4.5],
  ['gold-light on dark',           c.accentLight, c.dark,       4.5],
  /* Structure. These are the whole visual system now, so a hairline that
     cannot be seen is a layout that has fallen apart. */
  ['a hairline on the ground',     over(c.line, c.surface),       c.surface, 1.15],
  ['a strong line on the ground',  over(c.lineStrong, c.surface), c.surface, 1.35],
  /* An input's own edge is the only thing saying where to type, so it is a
     control boundary and carries the 3:1 that comes with one. */
  ['the edge of a field',          over(c.lineControl, c.surface), c.surface, 3.0],
];

let failed = 0;
const line = (name, fg, bg, min) => {
  const r = ratio(fg, bg);
  if (r < min) failed += 1;
  console.log(`${r >= min ? 'ok  ' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (needs ${min})  ${name}`);
};

for (const [name, fg, bg, min] of checks) line(name, fg, bg, min);

/* ── every accent a producer may pick ──────────────────────────────────────
   The accent is no longer one colour. A producer chooses from a shortlist,
   and the reason it is a shortlist rather than a colour picker is this block:
   a preset cannot ship without clearing the same four bars the base one does.
   Read from the source of truth rather than duplicated, because here the
   question really is whether every entry in that file passes.              */
const brand = await import('../src/content/brand.ts')
  .catch(() => null);

if (!brand) {
  console.log('\nFAIL  could not read src/content/brand.ts');
  failed += 1;
} else {
  for (const a of brand.ACCENTS) {
    console.log(`\n  ${a.key} — ${a.label}`);
    line(`${a.key}: as words, on ground`,   a.base,   c.surface,  4.5);
    line(`${a.key}: as words, on bright`,   a.base,   c.card,     4.5);
    line(`${a.key}: numerals, 24px and up`, a.bright, c.surface,  3.0);
    line(`${a.key}: on the dark ground`,    a.light,  c.dark,     4.5);
    /* A wash is a background. If it is dark enough that ink struggles on it,
       it is not a wash. */
    line(`${a.key}: ink on its wash`,       c.ink,    over(a.wash, c.surface), 4.5);
    line(`${a.key}: its own words on it`,   a.base,   over(a.wash, c.surface), 4.5);
    /* A producer's accent is also a button fill, and the label on it is the
       ivory. A preset that reads beautifully as words can still be too light
       to carry one. */
    line(`${a.key}: a label on it`,         c.surface, a.base,  4.5);
  }
}

/* ── Bride Mode ────────────────────────────────────────────────────────────
   The one screen that inverts. It overrides the tokens on its own block
   rather than carrying a second palette, and those overrides are exactly as
   able to be unreadable as the light ones. Checked here or checked nowhere. */
const over2 = (fg, a, ground) => {
  const g = parseInt(ground.slice(1), 16);
  const f = parseInt(fg.slice(1), 16);
  const mix = (x, y) => Math.round(x * a + y * (1 - a));
  return '#' + [
    mix((f >> 16) & 255, (g >> 16) & 255),
    mix((f >> 8) & 255, (g >> 8) & 255),
    mix(f & 255, g & 255),
  ].map((v) => v.toString(16).padStart(2, '0')).join('');
};

console.log('\n  Bride Mode');
line('inverted ink on the dark ground',  c.surface,                       c.dark, 4.5);
line('inverted soft ink',                over2(c.surface, 0.78, c.dark),  c.dark, 4.5);
line('inverted muted ink',               over2(c.surface, 0.60, c.dark),  c.dark, 4.5);
line('gold as words there',              c.accentLight,                   c.dark, 4.5);
/* The rules that carry the structure once the fills are gone. */
line('an inverted hairline',             over2(c.surface, 0.12, c.dark),  c.dark, 1.15);
line('an inverted control edge',         over2(c.surface, 0.45, c.dark),  c.dark, 3.0);

/* ── the dark palette ──────────────────────────────────────────────────────
   The same product after dark, and exactly as able to be unreadable as the
   light one. Every pairing above is asked again here against its own
   grounds, because a tone that clears 4.5:1 on ivory tells you nothing about
   what it does on charcoal: the light palette's green reads 2.3:1 here, and
   the deep teal that is the whole product's action colour reads 2.16:1.

   Two pairings exist only in this palette and are the ones a dark mode
   usually gets wrong. The accent becomes a pale fill, so its label is no
   longer white but the page's own near-black. And the band that used to be
   the dark one becomes the step up, so what is written on it is ordinary
   ink rather than the inverted kind. */
const d = {
  ink: '#EDF1F6', inkSoft: '#BAC1CB', inkMid: '#8A919C', inkMute: '#A3AAB5',
  surface: '#16181C', surface100: '#1F2228', surface200: '#25282E',
  card: '#1F2228',
  /* The band, which in this palette is the step up. */
  dark: '#25282E',
  line: '#343942', lineStrong: '#444A55', lineControl: '#757E8B',
  /* The accent's light tone, promoted to the main one. */
  accent: '#8FC4C1',
  accentLine: '#5E9F9B',
  /* 8% of that pale tone over the canvas, which is what --accent-wash
     resolves to once --accent-rgb has moved. */
  accentWash: '#202629',
  ok: '#7FB894', okWash: '#1B2922',
  warn: '#D9A94A', warnWash: '#292416',
  bad: '#E08278', badWash: '#2C1F1E',
  sage: '#272E2B', blush: '#2E2529',
};

console.log('\n  כהה');
line('body text on the ground',        d.ink,      d.surface,    4.5);
line('body text on the card',          d.ink,      d.card,       4.5);
line('secondary text',                 d.inkSoft,  d.surface,    4.5);
line('secondary on the card',          d.inkSoft,  d.card,       4.5);
line('mid ink, large text only',       d.inkMid,   d.surface,    3.0);
line('kickers and meta',               d.inkMute,  d.surface,    4.5);
line('kickers on the card',            d.inkMute,  d.card,       4.5);
line('kickers on the step above',      d.inkMute,  d.surface200, 4.5);
line('accent as words, on ground',     d.accent,   d.surface,    4.5);
line('accent as words, on the card',   d.accent,   d.card,       4.5);
line('accent on the step up',          d.accent,   d.surface200, 4.5);
line('accent on its own wash',         d.accent,   d.accentWash, 4.5);
/* The one that catches a dark mode built by inverting: a pale fill cannot
   carry a pale label, so the label is the page's ground. */
line('a button label on the accent',   d.surface,  d.accent,     4.5);
line('a button label on ink',          d.surface,  d.ink,        4.5);
line('good, on its wash',              d.ok,       d.okWash,     4.5);
line('waiting, on its wash',           d.warn,     d.warnWash,   4.5);
line('wrong, on its wash',             d.bad,      d.badWash,    4.5);
line('good, on the card',              d.ok,       d.card,       4.5);
line('waiting, on the card',           d.warn,     d.card,       4.5);
line('wrong, on the card',             d.bad,      d.card,       4.5);
line('a label on good',                d.surface,  d.ok,         4.5);
line('a label on waiting',             d.surface,  d.warn,       4.5);
line('a label on wrong',               d.surface,  d.bad,        4.5);
/* The two soft grounds carry ink and never words in their own hue. */
line('ink on the sage ground',         d.ink,      d.sage,       4.5);
line('ink on the blush ground',        d.ink,      d.blush,      4.5);
/* The band, now the step up, with ordinary ink on it. */
line('body on the band',               d.ink,      d.dark,       4.5);
line('the accent as words there',      d.accent,   d.dark,       4.5);
line('a hairline on the ground',       d.line,       d.surface,  1.15);
line('a strong line on the ground',    d.lineStrong, d.surface,  1.35);
line('the edge of a field',            d.lineControl, d.surface, 3.0);

/* Every producer's accent, after dark. Their `light` tone becomes the main
   one, which is the tone already solved for a dark ground — so this is not a
   new colour to pick, it is one they already have. What has to be checked is
   the half that is new: that tone as a fill with the page's ground on it. */
if (brand) {
  for (const a of brand.ACCENTS) {
    console.log(`\n  כהה — ${a.key}`);
    line(`${a.key}: as words, on the ground`, a.night, d.surface,    4.5);
    line(`${a.key}: as words, on the card`,   a.night, d.card,       4.5);
    line(`${a.key}: as words, on the step up`, a.night, d.surface200, 4.5);
    line(`${a.key}: a button label on it`,    d.surface, a.night,    4.5);
  }
}

/* ── high contrast ─────────────────────────────────────────────────────────
   The accessibility menu's contrast mode is a second palette, and somebody
   switches it on precisely because the first one is not working for them. It
   is checked at AAA rather than AA: at AA it would only have to match what
   the mode is meant to improve on. */
const hc = {
  ink: '#000000', inkSoft: '#1A1A1A', inkMute: '#2D2D2D',
  surface: '#FFFFFF', surface200: '#F0F0F0',
  accent: '#6A4F1C', accentLine: '#4A3714',
  line: '#767676', lineStrong: '#4A4A4A', lineControl: '#000000',
  /* The panel edge, which in this mode is a border somebody has to find
     rather than the soft finish it is on the default palette. */
  lineSoft: '#4A4A4A',
};

console.log('\n  ניגודיות גבוהה');
line('body text',                 hc.ink,      hc.surface,    7);
line('secondary text',            hc.inkSoft,  hc.surface,    7);
line('kickers and meta',          hc.inkMute,  hc.surface,    7);
line('the accent as words',       hc.accent,   hc.surface,    4.5);
line('the accent on the step up', hc.accent,   hc.surface200, 4.5);
line('a label on the accent',     hc.surface,  hc.accent,     4.5);
/* Here a hairline is a border somebody has to be able to find, so it is held
   to the 3:1 a control boundary needs rather than the 1.15 a hint does. */
line('a separator',               hc.line,     hc.surface,    3);
line('a group edge',              hc.lineStrong, hc.surface,  3);
line('the edge of a panel',       hc.lineSoft,   hc.surface,  3);
line('the edge of a field',       hc.lineControl, hc.surface, 3);

console.log(failed === 0 ? '\nall pairings pass' : `\n${failed} below target`);
process.exit(failed === 0 ? 0 : 1);
