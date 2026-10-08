/**
 * Every screen that reads the wording is under something that provides it.
 *
 *     node scripts/check-copy.mjs
 *
 * `useCopy()` used to have a safety net: the context defaulted to the whole
 * Hebrew copy tree, so a component mounted with no provider above it rendered
 * Hebrew rather than nothing. That was a good instinct and it cost 35KB
 * gzipped on every route in the product, because the default is an import,
 * an import of `APP_UI_HE` reaches `content/site.ts`, and `content/site.ts`
 * is a quarter of a megabyte of wording for every screen there is. It was in
 * the bundle of the guests' page, which has no app on it at all: that page
 * went from 73KB to 38KB the moment the default came out. A grandparent
 * opening a wedding invitation on a phone was downloading the producer's
 * crew board labels.
 *
 * `GameTable` already knew. It writes out twenty lines of `Sheet`'s behaviour
 * by hand rather than import it, and says why in a comment: Sheet reads one
 * label through `useCopy()`, "which means a CopyProvider, which means
 * shipping the whole app's copy to a route whose entire design is that it is
 * not the app".
 *
 * So the default is gone and `useCopy()` throws instead. That is the right
 * trade only if the thing it was protecting against cannot happen, and this
 * is the proof rather than the hope: for every page in the app, walk what it
 * imports, and if anything down there reads the wording, then the page or one
 * of the layouts above it has to provide it.
 *
 * It walks imports rather than trusting a list, because a list is a thing
 * somebody forgets to add to. The walk follows `@/` imports only: a component
 * cannot acquire `useCopy` through `react` or `lucide-react`.
 *
 * Comments are stripped before anything is looked for, which is not a
 * nicety: the first run of this reported the card game, and the only
 * `useCopy()` in that file is inside the comment explaining why it does not
 * use one. A checker that reads prose as code cries wolf on the one file
 * that got the rule right.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const APP = join(SRC, 'app');

/** `@/x/y` is `src/x/y`, with the extension and the `/index` guessed the way
 *  the bundler guesses them. */
function resolve(spec, from) {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2))
    : spec.startsWith('.') ? join(dirname(from), spec)
    : null;
  if (!base) return null;
  for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(p) && !readdirSyncSafe(p)) return p;
  }
  return null;
}
const readdirSyncSafe = (p) => { try { return readdirSync(p); } catch { return null; } };

const IMPORT = /\bfrom\s+'([^']+)'/g;
const cache = new Map();

/** Block and line comments out, so prose about the rule is not read as a use
 *  of it. Crude and sufficient: an import specifier cannot contain `//`, and
 *  the only thing this changes is which text is searched. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Does this file, or anything it reaches, read the wording? */
function readsCopy(file, seen = new Set()) {
  if (cache.has(file)) return cache.get(file);
  if (seen.has(file)) return false;
  seen.add(file);

  const src = stripComments(readFileSync(file, 'utf8'));
  /* The provider's own module mentions `useCopy` because it defines it. */
  const here = !file.endsWith('CopyProvider.tsx') && /\buseCopy\s*\(/.test(src);
  let found = here;
  if (!found) {
    for (const m of src.matchAll(IMPORT)) {
      const next = resolve(m[1], file);
      if (next && readsCopy(next, seen)) { found = true; break; }
    }
  }
  cache.set(file, found);
  return found;
}

/* Everything the router can put on a screen, not only `page.tsx`. A skeleton
   and an error boundary are mounted in the same place a page is and can read
   the wording the same way, and the first version of this walked only pages:
   a `loading.tsx` with a label in it would have thrown and nothing here
   would have said so. `error.tsx` is in the list for the sharpest version of
   it - the screen somebody sees when the screen already went wrong. */
const MOUNTS = new Set(['page.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx', 'template.tsx']);

/** The files the router mounts, and the layouts standing over each one. */
function pages(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) pages(p, out);
    else if (MOUNTS.has(name.name)) out.push(p);
  }
  return out;
}

/* Up to the root of the router and not to `src/app/app`, which is where the
   first version of this stopped. It walked the producer's screens only, so a
   component mounted in the root layout - above the shopfront, the guests'
   page and the card game, none of which has a provider - was never looked
   at. `VersionWatch` was exactly that, and it is the mount that made the
   old Hebrew default load-bearing. The dev server found it in four seconds
   and this file had just said every screen was covered. */
function layoutsOver(page) {
  const out = [];
  let dir = dirname(page);
  while (dir.startsWith(APP)) {
    const l = join(dir, 'layout.tsx');
    if (existsSync(l)) out.push(l);
    if (dir === APP) break;
    dir = dirname(dir);
  }
  return out;
}

/* A layout is a mount in its own right: whatever it draws beside `children`
   is on every page under it, and nothing in this walk would otherwise look
   at it. */
function layouts(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) layouts(p, out);
    else if (e.name === 'layout.tsx') out.push(p);
  }
  return out;
}

const PROVIDES = /<CopyProvider\b/;

const naked = [];
let covered = 0;
let seenMounts = 0;

for (const page of [...pages(APP), ...layouts(APP)]) {
  seenMounts += 1;
  if (!readsCopy(page)) continue;
  /* A layout counts as covered by its own provider. Strictly that is a
     guess - the provider wraps `children` and this cannot see whether the
     thing reading the wording is inside it - and it is the right guess: a
     layout that wraps its children and reads the wording outside that
     wrapper is something to write differently. What matters is the case
     this exists for, a layout that provides nothing at all, and that one is
     caught either way. */
  const chain = [page, ...layoutsOver(page)];
  const provided = chain.some((f) => PROVIDES.test(readFileSync(f, 'utf8')));
  if (provided) covered += 1;
  else naked.push(relative(root, page));
}

if (naked.length > 0) {
  console.error('\n  these screens read the wording and nothing above them provides it:\n');
  for (const p of naked) console.error(`    ${p}`);
  console.error('\nWrap the page, or a layout over it, in <CopyProvider value={appUiFor(locale)}>.');
  console.error('`useCopy()` throws without one, on purpose: the old default pulled the whole');
  console.error('copy tree into every bundle in the product.\n');
  process.exit(1);
}

console.log(`\nevery screen that reads the wording is given it  (${covered} of ${seenMounts} mounts)\n`);
