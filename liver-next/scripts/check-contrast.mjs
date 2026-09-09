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

const c = {
  ink: '#0E1620', inkSoft: '#47566A', inkMute: '#5B697C',
  surface: '#F3F6FA', surface100: '#F9FBFD', surface200: '#E7ECF3',
  card: '#FFFFFF',
  line: '#DBE2EC', lineStrong: '#C4CEDB',
  accent: '#2E5F8C', accentSoft: '#4A80B0', accentBright: '#4C8BC4', accentWash: '#E9F0F8',
  ok: '#2F6B4F', okWash: '#E3EFE8',
  warn: '#8A5A17', warnWash: '#F7EDDC',
  bad: '#9A2B2B', badWash: '#F8E8E7',
};

const checks = [
  ['body text on the ground',      c.ink,        c.surface,     4.5],
  ['body text on a card',          c.ink,        c.card,        4.5],
  ['secondary text on a card',     c.inkSoft,    c.card,        4.5],
  ['secondary on the ground',      c.inkSoft,    c.surface,     4.5],
  ['muted text on a card',         c.inkMute,    c.card,        4.5],
  ['muted on the ground',          c.inkMute,    c.surface,     4.5],
  ['muted on the step above',      c.inkMute,    c.surface200,  4.5],
  ['accent as a link, on a card',  c.accent,     c.card,        4.5],
  ['accent as a link, on ground',  c.accent,     c.surface,     4.5],
  ['accent on its own wash',       c.accent,     c.accentWash,  4.5],
  ['accent-soft as a border',      c.accentSoft, c.card,        3.0],
  ['bright accent, never words',   c.accentBright, c.surface,   3.0],
  ['good, on its wash',            c.ok,         c.okWash,      4.5],
  ['waiting, on its wash',         c.warn,       c.warnWash,    4.5],
  ['wrong, on its wash',           c.bad,        c.badWash,     4.5],
  ['a button label on ink',        c.surface100, c.ink,         4.5],
  ['a hairline against a card',    c.line,       c.card,        1.2],
  ['a strong line on a card',      c.lineStrong, c.card,        1.4],
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
    line(`${a.key}: as a link, on a card`,  a.base,   c.card,     4.5);
    line(`${a.key}: as a link, on ground`,  a.base,   c.surface,  4.5);
    line(`${a.key}: on its own wash`,       a.base,   a.wash,     4.5);
    line(`${a.key}: soft, as a border`,     a.soft,   c.card,     3.0);
    line(`${a.key}: bright, never words`,   a.bright, c.surface,  3.0);
    /* A wash is a background. If it is dark enough that ink struggles on it,
       it is not a wash. */
    line(`${a.key}: ink on its wash`,       c.ink,    a.wash,     4.5);
  }
}

console.log(failed === 0 ? '\nall pairings pass' : `\n${failed} below target`);
process.exit(failed === 0 ? 0 : 1);
