/**
 * Does the class you wrote produce a declaration?
 *
 *     node scripts/check-classes.mjs
 *
 * Two ways a colour class can be written, read fine in review, survive a
 * build, and paint nothing at all. Both had happened here, and neither is
 * visible in a diff:
 *
 *   1. A token that does not exist. `hover:bg-accent-soft` looks like a
 *      sibling of `bg-accent-bright`. There is no `soft` on the accent, so
 *      Tailwind emits no rule and the button's hover state is inert.
 *
 *   2. An opacity modifier on a token whose custom property holds a whole
 *      colour. Tailwind can only fold an alpha into a property holding bare
 *      channels. `border-accent/40` against `var(--accent)` compiles to
 *      nothing, so the border never appears. Thirty-three declarations were
 *      being dropped this way, including the dimming behind two modals.
 *
 * Both failures are silent, which is what makes them worth a script. A wrong
 * colour gets noticed. A missing one looks like a design decision.
 *
 * The config is the source of truth here, deliberately — unlike the contrast
 * script, which duplicates its values because there the question is whether
 * the palette is readable, not whether it is self-consistent. Here the
 * question really is "does this class resolve against the config", so the
 * config is what it is asked against.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { default: config } = await import('../tailwind.config.ts');

/* ── what the config actually defines ──────────────────────────────────── */
/* A token may take an opacity modifier only if its value carries the
   <alpha-value> placeholder. Everything else is a whole colour: either a
   literal hex, which Tailwind can add an alpha to itself, or a bare
   `var(--x)`, which it cannot. */
const solid = new Set();   // takes /NN
const whole = new Set();   // does not

const walkColors = (obj, prefix = '') => {
  for (const [key, value] of Object.entries(obj)) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (value && typeof value === 'object') { walkColors(value, name); continue; }
    if (typeof value !== 'string') continue;
    /* A hex literal is fine: Tailwind rewrites it to rgb(… / alpha) itself.
       A var() is only fine when the author left the placeholder in it. */
    const takesAlpha = value.includes('<alpha-value>') || /^#[0-9a-f]{3,8}$/i.test(value);
    (takesAlpha ? solid : whole).add(name);
  }
};
walkColors(config.theme.extend.colors);

const roots = new Set([...solid, ...whole].map((t) => t.split('-')[0]));

/* ── what the source asks for ──────────────────────────────────────────── */
/* Only the properties that take a colour. `accent-` is in this list twice
   over: `accent-color` is a real Tailwind property and `accent` is one of
   our token roots, so `accent-[var(--accent)]` has to be left alone. */
const props = [
  'bg', 'text', 'border', 'ring', 'divide', 'outline', 'decoration',
  'fill', 'stroke', 'caret', 'placeholder', 'from', 'to', 'via', 'shadow',
  /* `accent-color`, which is how a native checkbox is tinted. It shares its
     name with one of our token roots, so `accent-accent` is a real class and
     parses as this property carrying that tone. */
  'accent',
];

const propSet = new Set(props);

/* Deliberately not one clever regular expression. The first attempt at this
   was, and it quietly matched `bg-accent` inside `hover:bg-accent-soft` and
   then found nothing else on the line — so the very bug that prompted the
   script slipped through it. Splitting the text into candidate class names
   first and parsing each one on its own is longer and has no such corners. */
const candidates = (text) => text.split(/[^A-Za-z0-9_:/.[\]-]+/).filter(Boolean);

/** `hover:focus-visible:bg-accent/40` → { prop: 'bg', token: 'accent', alpha: '40' } */
function parse(candidate) {
  /* Variants come first and each ends in a colon. An arbitrary value can
     carry a colon of its own inside brackets, so those are left alone. */
  if (candidate.includes('[')) return null;
  const bare = candidate.slice(candidate.lastIndexOf(':') + 1);

  const slash = bare.indexOf('/');
  const alpha = slash === -1 ? null : bare.slice(slash + 1);
  if (alpha !== null && !/^\d+$/.test(alpha)) return null;
  const name = slash === -1 ? bare : bare.slice(0, slash);

  const dash = name.indexOf('-');
  if (dash === -1) return null;
  const prop = name.slice(0, dash);
  const token = name.slice(dash + 1);
  if (!propSet.has(prop)) return null;
  /* Only our own palette is being checked. Tailwind's built-in colours and
     the arbitrary values are somebody else's problem. */
  if (!roots.has(token.split('-')[0])) return null;
  return { prop, token, alpha };
}

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
  }
};
walk(join(root, 'src'));

const unknown = [];
const dropped = [];

for (const file of files) {
  const where = relative(root, file);
  readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
    for (const candidate of candidates(text)) {
      const hit = parse(candidate);
      if (!hit) continue;
      const { prop, token, alpha } = hit;
      if (!solid.has(token) && !whole.has(token)) {
        unknown.push({ where, line: i + 1, cls: `${prop}-${token}` });
      } else if (alpha !== null && whole.has(token)) {
        dropped.push({ where, line: i + 1, cls: `${prop}-${token}/${alpha}` });
      }
    }
  });
}

const report = (rows, title, why) => {
  if (!rows.length) return 0;
  console.log(`\n${title}`);
  console.log(`  ${why}\n`);
  for (const r of rows) console.log(`  ${r.where}:${r.line}  ${r.cls}`);
  return rows.length;
};

let failed = 0;
failed += report(
  unknown, 'FAIL  no such token',
  'These compile to no declaration. Check the name against tailwind.config.ts.',
);
failed += report(
  dropped, 'FAIL  opacity modifier on a whole colour',
  'Tailwind cannot fold an alpha into a property that holds a whole colour.\n'
  + '  Either drop the modifier, or give the token a channel form\n'
  + '  (`rgb(var(--x-rgb) / <alpha-value>)`) the way the solid tones have.',
);

if (failed === 0) {
  console.log(
    `every palette class resolves  (${solid.size} tones take an opacity `
    + `modifier, ${whole.size} are whole and do not)`,
  );
}
process.exit(failed === 0 ? 0 : 1);
