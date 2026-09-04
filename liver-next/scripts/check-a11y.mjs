/**
 * Can somebody who is not looking at the screen use this?
 *
 *     node scripts/check-a11y.mjs --url http://localhost:3000
 *
 * The contrast checker already proves every pairing in the palette is legible.
 * That is one rule out of a standard, and the nine it does not cover are the
 * ones that decide whether a screen reader announces a control or reads out
 * "button", whether a form error is reachable, and whether a heading level was
 * skipped so the page has no outline to navigate by.
 *
 * axe-core answers those against the rendered page rather than the source,
 * which matters here: this product is Hebrew and right to left, half its
 * screens are built from components that only exist once mounted, and none of
 * that is visible in a file.
 *
 * `/design` is the page worth checking hardest — it mounts nearly every
 * component in the product with fixtures, so one load covers what would
 * otherwise need an account and twenty clicks. The public pages follow,
 * because they are what a stranger meets first.
 *
 * What this cannot do is the half that matters most, and saying so is part of
 * the check: automated rules catch roughly a third of real barriers. Keyboard
 * order, focus that goes somewhere sensible after a dialog closes, and whether
 * an announcement makes sense out loud are all things a person has to try.
 * The list at the end names them rather than letting a green run imply they
 * were covered.
 *
 * Read only. Playwright is not a dependency of this project; without it the
 * check says so and exits cleanly rather than failing a build for a tool.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const base = arg('url', process.env.VERIFY_URL ?? 'http://localhost:3000');

/* Public routes and the harness. Everything behind the sign-in redirects for a
   browser with no session, and the harness covers the components those screens
   are built from. */
const ROUTES = ['/design', '/', '/login', '/store', '/privacy', '/install'];

/* WCAG 2.2 at AA, which is the bar the release standard names. `best-practice`
   is deliberately absent: it is advice rather than the standard, and mixing
   the two turns a failing run into an argument about whether it counts. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

let playwright;
try {
  playwright = await import('playwright');
} catch {
  try {
    playwright = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  } catch {
    console.log('playwright is not installed, so the accessibility check was skipped.\n');
    process.exit(0);
  }
}

const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await playwright.chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({ viewport: { width: 1180, height: 900 } });

const findings = [];
let checked = 0;

for (const route of ROUTES) {
  const page = await context.newPage();
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(800);
  } catch (e) {
    findings.push({ route, id: 'page did not load', impact: 'serious', help: String(e).split('\n')[0], nodes: [] });
    await page.close();
    continue;
  }

  await page.evaluate(axeSource);
  const result = await page.evaluate(
    async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );

  for (const v of result.violations) {
    findings.push({
      route,
      id: v.id,
      impact: v.impact ?? 'unknown',
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    });
  }
  checked++;
  await page.close();
}

/**
 * And the one manual check that is not manual: does the page fit a phone?
 *
 * "No horizontal scrolling except inside an intentional data view" is a rule
 * a person is supposed to notice by looking, which means it is a rule nobody
 * notices until somebody complains. It is arithmetic: at 360 pixels, the
 * narrowest screen this product is designed for, the document must not be
 * wider than the window. A table or a tab strip that scrolls inside its own
 * box is fine and expected; the body is not.
 */
const narrow = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
for (const route of ROUTES) {
  const page = await narrow.newPage();
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      const spill = doc.scrollWidth - doc.clientWidth;
      if (spill <= 1) return null;
      /* Name the widest thing sticking out, or the report is "something is
         too wide" and somebody has to go looking. */
      let worst = '', width = 0;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > width && r.right > doc.clientWidth + 1) {
          width = r.width;
          worst = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? `.${el.className.split(' ').slice(0, 2).join('.')}` : '');
        }
      }
      return { spill, worst };
    });
    if (over) {
      findings.push({
        route, id: 'the page is wider than the phone', impact: 'serious',
        help: `${over.spill}px of the document sits outside a 360px window`,
        nodes: over.worst ? [over.worst] : [],
      });
    }
  } catch { /* the load failure is already reported above */ }
  await page.close();
}
await narrow.close();

await browser.close();

const RANK = { critical: 0, serious: 1, moderate: 2, minor: 3, unknown: 4 };
findings.sort((a, b) => (RANK[a.impact] ?? 9) - (RANK[b.impact] ?? 9));

/* The rules nothing can check, named so a clean run does not read as a claim
   that the whole standard was met. */
const BY_HAND = [
  'tab through every screen: focus order follows the reading order',
  'close a dialog: focus returns to the control that opened it',
  'zoom to 200 per cent: nothing is cut off (the 360px pass above only covers width)',
  'a screen reader in Hebrew: names announce, and mixed Latin text reads in the right direction',
  'drag and drop: the seating plan and the run sheet have a keyboard route',
];

if (findings.length === 0) {
  console.log(`\nno automated barrier found  (${checked} pages at WCAG 2.2 AA, and the same ${checked} at 360px)\n`);
  console.log('Automated rules catch about a third of real barriers. Still to try by hand:');
  for (const line of BY_HAND) console.log(`  · ${line}`);
  console.log('');
  process.exit(0);
}

console.error(`\n${findings.length} barrier${findings.length === 1 ? '' : 's'} across ${checked} pages:\n`);
for (const f of findings) {
  console.error(`  ${f.impact.padEnd(9)} ${f.route}  ${f.id}`);
  console.error(`            ${f.help}`);
  for (const n of f.nodes) console.error(`            ${n.slice(0, 90)}`);
  console.error('');
}
process.exit(1);
