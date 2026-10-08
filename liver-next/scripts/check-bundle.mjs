/**
 * How much JavaScript each screen makes somebody download.
 *
 *     npm run build && node scripts/check-bundle.mjs
 *
 * A bundle grows the way a type scale grows: one reasonable local decision at
 * a time, none of them worth arguing with, and nobody is ever looking at the
 * total. This is the same answer `npm run type` is for font sizes and
 * `npm run classes` is for colour — a number that fails the build, so the
 * growth has to be a decision rather than an accident.
 *
 * It was written the day the measurement was taken, and the measurement found
 * 35KB of gzipped Hebrew on every route in the product, including the page a
 * guest opens to say whether they are coming. Nothing about that was visible
 * from any file.
 *
 * Three budgets rather than sixty, because a table with a number per route is
 * a table nobody maintains, and because the three are a real distinction:
 *
 *   A stranger or a guest did not choose to be here. They followed a link to
 *   an invitation or a landing page, probably on a phone, probably on data,
 *   and the page has one job. It gets the tightest number.
 *
 *   A couple opens their own screen over and over for a year. It carries
 *   their whole wedding, so it is allowed to be larger, and it is the one
 *   most worth watching because it is the one most often on a phone.
 *
 *   A producer sits at a desk with the console open all day and it is cached
 *   after the first load. Loosest.
 *
 * `/design` is exempt, and that is not a loophole. It mounts every component
 * in the product at once so that they can be looked at, it returns a 404 in
 * production, and no person ever downloads it. Holding it to a budget would
 * mean deleting panels from the harness to stay under a number, which is the
 * check making the product worse.
 *
 * Gzip rather than raw, because gzip is what crosses the wire. Counted per
 * route over everything that route's HTML actually asks for, so a chunk
 * shared by two screens is counted against both: what matters is what one
 * person waits for, not what the disk holds.
 *
 * **That last part was wrong for a day and the numbers it printed were a
 * fifth of the truth.** It summed the route's own `entryJSFiles` and nothing
 * else, so it left out the framework, the runtime and the polyfills - the
 * six `rootMainFiles` and the polyfill bundle that every page in the product
 * loads before anything of ours runs. It reported the privacy page at 37KB
 * and the live privacy page downloads 200. The saving it was built to
 * measure was real, because before and after were counted the same way, and
 * the budgets were nonsense: they were set against a number that was not
 * what anybody waits for. Checked against the live site rather than against
 * itself, which is the only way this kind of mistake ever surfaces.
 *
 * The numbers are set just above where the product is, deliberately, and
 * that is the only setting that works. The first ones written here were
 * round and generous, and the regression this check exists to catch - 35KB
 * of copy on every page - would have passed under them with room to spare.
 * A ceiling nothing can reach is a ceiling that never fires. Checked both
 * ways: each budget is about five per cent above today, and putting the
 * 35KB back puts every one of the four over.
 *
 * The floor is worth knowing when reading them. 166KB of the number against
 * every budget here is React, Next and the polyfills, which is the same
 * 166KB on every page in the product and is cached after the first one.
 * Nothing in this repository can move it, which is exactly why it is
 * counted: a budget that quietly excluded the largest thing on the page
 * would be measuring our own work and calling it the visitor's wait.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, process.env.NEXT_DIST_DIR || '.next');

/** Kilobytes, gzipped, that one visitor waits for on first arrival. */
const BUDGET = [
  /* The way in, which is its own thing and was caught by the first run of
     this being lumped in with the guests at 106KB. It is the only page in
     the product that needs the auth client, nobody arrives at it by
     following an invitation, and everybody who does arrive has an account.
     A number of its own rather than a hole in the guests' one. */
  { kb: 288, is: (r) => r.includes('/login') || r.startsWith('/auth/'), say: 'the way in' },
  /* A stranger, a guest, a couple playing the card game, a supplier signing.
     Everything else outside `/app`. */
  { kb: 240, is: (r) => !r.startsWith('/app/'), say: 'a stranger or a guest' },
  /* The couple's own screens. */
  { kb: 395, is: (r) => r.startsWith('/app/portal'), say: "the couple's screen" },
  /* The console. */
  { kb: 425, is: () => true, say: "the producer's console" },
];

/* The harness, which is every component at once and is a 404 in production. */
const EXEMPT = ['/design/page'];

function manifests(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) manifests(p, out);
    else if (e.name === 'page_client-reference-manifest.js') out.push(p);
  }
  return out;
}

const found = manifests(join(dist, 'server', 'app'));
if (found.length === 0) {
  /* The failure the contrast script taught: a check with nothing to read must
     say so rather than report that everything passed. */
  console.error(`\n  no build under ${dist}. Run \`npm run build\` first.\n`);
  process.exit(1);
}

globalThis.self = globalThis;
for (const f of found) require(f);

/* What every page loads before any of our code runs. Next lists these
   separately from the route's own chunks, which is exactly how they went
   missing. */
const shared = (() => {
  try {
    const m = JSON.parse(readFileSync(join(dist, 'build-manifest.json'), 'utf8'));
    return [...(m.rootMainFiles ?? []), ...(m.polyfillFiles ?? [])];
  } catch { return []; }
})();

const gz = new Map();
const weigh = (rel) => {
  const p = join(dist, rel);
  if (!existsSync(p)) return 0;
  if (!gz.has(p)) gz.set(p, gzipSync(readFileSync(p)).length);
  return gz.get(p);
};

const rows = [];
for (const [route, m] of Object.entries(self.__RSC_MANIFEST ?? {})) {
  if (EXEMPT.includes(route)) continue;
  const chunks = new Set(shared);
  for (const group of Object.values(m.entryJSFiles ?? {})) for (const c of group) chunks.add(c);
  let bytes = 0;
  for (const c of chunks) bytes += weigh(c);
  const budget = BUDGET.find((b) => b.is(route));
  rows.push({ route, kb: bytes / 1024, budget });
}
rows.sort((a, b) => b.kb - a.kb);

const over = rows.filter((r) => r.kb > r.budget.kb);
if (over.length > 0) {
  console.error('\n  these screens ask for more than their budget:\n');
  for (const r of over) {
    console.error(`    ${r.route.padEnd(44)} ${r.kb.toFixed(1)}KB  over ${r.budget.kb}KB for ${r.budget.say}`);
  }
  console.error('\nEither take something out, or raise the number in scripts/check-bundle.mjs');
  console.error('and say in the commit what the screen gained that is worth the wait.\n');
  process.exit(1);
}

const worst = (say) => {
  const r = rows.filter((x) => x.budget.say === say)[0];
  return r ? `${r.kb.toFixed(0)} of ${r.budget.kb}` : 'none';
};
console.log(
  `\nevery screen is inside its budget  (worst: ${worst('a stranger or a guest')}KB for a guest, `
  + `${worst("the couple's screen")}KB for the couple, ${worst("the producer's console")}KB for the console)\n`,
);
