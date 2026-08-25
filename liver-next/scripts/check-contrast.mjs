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

/* The Lux palette. Warm throughout: no white, no slate, no blue. The three
   marked values are darker than the design handoff's, because the handoff's
   fail the text they are used for on this ground. */
const c = {
  ink: '#1A1613', inkSoft: '#6B6259', inkMid: '#8A7A66',
  inkMute: '#726858',              /* handoff #A79881 → 2.64:1 at 11px */
  surface: '#FAF7F2', surface100: '#FFFDF9', surface200: '#EDEAE4',
  card: '#FFFDF9',
  dark: '#0E0C0A',
  line: 'rgba(26,22,19,.09)', lineStrong: 'rgba(26,22,19,.16)',
  lineControl: 'rgba(26,22,19,.48)',
  accent: '#846941',               /* handoff #B08D57 → 2.89:1 as words */
  accentBright: '#A18150',         /* large numerals only, 3:1 bar      */
  accentLine: '#B08D57',           /* decoration, no bar                */
  accentLight: '#D8BC8A',
  accentWash: '#F5F0E8',
  ok: '#3D6B4A', okWash: '#E8EFE7',
  warn: '#8A5A17', warnWash: '#F5EEDF',
  bad: '#96322A', badWash: '#F5E7E3',
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

console.log(failed === 0 ? '\nall pairings pass' : `\n${failed} below target`);
process.exit(failed === 0 ? 0 : 1);
