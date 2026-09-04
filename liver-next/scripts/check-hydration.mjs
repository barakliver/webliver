/**
 * Does the browser agree with the server about what it just sent?
 *
 *     node scripts/check-hydration.mjs --url http://localhost:3000
 *
 * A hydration mismatch is the one class of bug that every other check we run
 * is blind to. TypeScript compiles it, the tests pass it, the build emits it,
 * and `verify.mjs` fetches the page and gets a healthy 200 — because the
 * server's half is fine. React then throws the server's HTML away in the
 * browser and rebuilds the tree, and what the person sees is a shell with
 * nothing in it. That is exactly how six screens came to be reported as blank
 * when one component in the top bar was at fault.
 *
 * So this check runs the page rather than reading it, in several browsers that
 * differ from the machine that rendered it in the ways real visitors do: a Mac
 * rather than a Linux server, an English locale rather than a Hebrew one, a
 * clock in Israel rather than in UTC. Any hydration error, on any of them, is
 * a failure.
 *
 * `/design` earns its place at the top of the list: it mounts nearly every
 * client component in the product with fixtures, so one page load exercises
 * what would otherwise take an account and twenty clicks to reach.
 *
 * Read only. It loads pages and listens. Playwright is not a dependency of
 * this project, so when it is not installed the check says so and exits
 * cleanly rather than failing a build for a missing tool.
 */

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const base = arg('url', process.env.VERIFY_URL ?? 'http://localhost:3000');

/* Public routes only. Everything behind the sign-in redirects to /login for a
   browser with no session, and a checker that followed it would report on the
   sign-in screen four times over. The harness covers the components those
   screens are built from. */
const ROUTES = ['/design', '/', '/login', '/store'];

/* Each one is a way a real visitor differs from the server that rendered the
   page. `platform` is the reason this file exists: reading it while rendering
   made the server and a Mac disagree about two characters, on every screen. */
const CLIENTS = [
  { name: 'baseline', context: {} },
  { name: 'Mac', context: {}, platform: 'MacIntel' },
  { name: 'iPhone', context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, platform: 'iPhone' },
  { name: 'English locale', context: { locale: 'en-US' } },
  { name: 'Israel clock', context: { timezoneId: 'Asia/Jerusalem' } },
];

/* React ships its messages minified in a production build, so the words are
   gone and only the number survives. 418 and 423 are the hydration pair; 425
   is the text-content mismatch. The unminified sentence is matched too, for a
   development server. */
const HYDRATION = /Minified React error #(418|423|425)|Hydration failed|did not match|hydrat/i;

let playwright;
try {
  playwright = await import('playwright');
} catch {
  try {
    playwright = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  } catch {
    console.log('playwright is not installed, so the hydration check was skipped.');
    console.log('install it, or run this on a machine that has it, to cover this class.');
    process.exit(0);
  }
}

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await playwright.chromium.launch(executablePath ? { executablePath } : {});

let checked = 0;
const failures = [];

for (const client of CLIENTS) {
  const context = await browser.newContext(client.context);

  /* Set before any page script runs, so the browser's first render sees it —
     which is the render that has to match what arrived from the server. */
  if (client.platform) {
    await context.addInitScript((value) => {
      Object.defineProperty(navigator, 'platform', { get: () => value });
    }, client.platform);
  }

  for (const route of ROUTES) {
    const page = await context.newPage();
    const seen = [];
    page.on('console', (m) => { if (m.type() === 'error') seen.push(m.text()); });
    page.on('pageerror', (e) => seen.push(String(e)));

    try {
      const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60_000 });
      /* A redirect to the sign-in screen is the correct answer for a stranger,
         and the page that was actually rendered still gets checked. */
      if (res && res.status() >= 500) {
        failures.push({ client: client.name, route, why: `the server answered ${res.status()}` });
      }
      /* React reports a mismatch during hydration, which finishes after the
         network goes quiet. A moment of grace rather than a fixed wait for
         everything: the listeners are already attached. */
      await page.waitForTimeout(1200);
    } catch (e) {
      failures.push({ client: client.name, route, why: String(e).split('\n')[0] });
      await page.close();
      continue;
    }

    const bad = seen.filter((m) => HYDRATION.test(m));
    if (bad.length > 0) {
      failures.push({ client: client.name, route, why: bad[0].split('\n')[0].slice(0, 160) });
    }
    checked++;
    await page.close();
  }

  await context.close();
}

await browser.close();

const pageWord = checked === 1 ? 'page load' : 'page loads';
if (failures.length === 0) {
  console.log(`\nserver and browser agree  (${checked} ${pageWord}, ${CLIENTS.length} kinds of visitor)\n`);
  process.exit(0);
}

console.error(`\n${failures.length} of ${checked} ${pageWord} disagreed:\n`);
for (const f of failures) {
  console.error(`  ${f.route}  as ${f.client}`);
  console.error(`    ${f.why}\n`);
}
console.error('A mismatch means the browser threw away what the server sent and');
console.error('rebuilt the page. Look for a value read while rendering that the');
console.error('server cannot know: navigator, window, the machine\'s clock or locale.\n');
process.exit(1);
