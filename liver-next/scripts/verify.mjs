/**
 * Is the thing that is running the thing we shipped?
 *
 *     node scripts/verify.mjs
 *
 * Run it on the server after a deploy. It answers the question a person cannot
 * answer by looking at a page: not "does it look right" but "is this actually
 * the new build, and does every screen still return a page".
 *
 * Read only. It fetches pages and reads the build output. It writes nothing,
 * touches no database, and is safe to run at any time, including while people
 * are using the app.
 *
 * A redirect to /login counts as a pass. Every screen behind the sign-in is
 * supposed to do that to a stranger, and a checker that called it a failure
 * would cry wolf on the correct behaviour.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.VERIFY_URL ?? 'http://127.0.0.1:3000';

let pass = 0, fail = 0;
const results = [];

function record(ok, label, detail = '') {
  ok ? pass++ : fail++;
  results.push({ ok, label, detail });
}

async function page(path, label, { expect = [200, 307, 308] } = {}) {
  try {
    const res = await fetch(base + path, { redirect: 'manual' });
    const ok = expect.includes(res.status);
    record(ok, label, `${path} → ${res.status}`);
    return ok ? res : null;
  } catch (e) {
    record(false, label, `${path} → ${e.message}`);
    return null;
  }
}

// ── the build on disk is the one we think it is ─────────────────────────────
// The palette lives in the compiled CSS. If the previous one is still in there,
// the running build predates the palette change, whatever the page looks like
// through a phone on a slow connection.
function checkBuiltCss() {
  /* Walked rather than read from a fixed path. This version emits the
     stylesheet into static/chunks alongside the JavaScript, not into
     static/css, and a checker that knows one path reports a missing
     stylesheet the day that changes — which it just did, on its first run. */
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) found.push(full);
    }
  };
  walk(join(root, '.next', 'static'));

  if (found.length === 0) {
    return record(false, 'built stylesheet', 'no css under .next/static — has it been built?');
  }

  const css = found.map((f) => readFileSync(f, 'utf8')).join('');

  const has = (hex) => css.includes(hex.toLowerCase()) || css.includes(hex.toUpperCase());

  /* The Lux ground and the warm ink, as the declarations that define them
     rather than as loose hex. Checked in the compiled stylesheet rather than
     in the config, because the question is what the browser received.

     Written this precisely because the loose form lied. `has('#1a1613')` had
     been passing on the strength of `--line:#1a161317`, which is the hairline
     with its alpha folded in — so the check reported the ink present in a
     build that no longer contained it anywhere as a colour. A check that
     passes for the wrong reason is worse than one that fails. */
  record(/--surface-rgb:\s*250 247 242/.test(css), 'the warm ground is in the build');
  record(/--ink-rgb:\s*26 22 19/.test(css), 'the warm ink is in the build');
  record(/--accent-rgb:\s*132 105 65/.test(css), 'the measured gold is in the build');

  /* And the two palettes it replaced. A build that still carries the slate is
     a build that predates the design work, whatever the page looks like on a
     phone over a slow connection. */
  record(!has('#f3f6fa'), 'the slate ground is gone');
  record(!has('#2e5f8c'), 'the slate accent is gone');

  /* The gold the handoff shipped reads 2.89:1 against ivory, under the 3:1 a
     large numeral needs. If it is back in the stylesheet as a text colour,
     somebody has reverted the measured value. */
  /* Anchored to the start of a declaration. Unanchored, `color:` is also the
     tail of `border-color:` and `background-color:`, and this reported a
     violation against `.border-accent-line`, which is exactly the decorative
     use the tone is for. */
  record(
    !/[;{]\s*color:\s*(#b08d57|rgb\(var\(--accent-line-rgb)/i.test(css),
    'the unmeasured gold is not used as text',
  );

  /* Structure is hairlines now, not glass. A backdrop-filter left on content
     means a card survived the sweep. */
  record(has('--line-control'), 'control edges have their own token');

  /* The tones are stored as channels so that an opacity modifier resolves at
     all. Tailwind can only fold an alpha into a custom property holding bare
     channels; against a whole colour it emits no declaration, so a rule like
     `border-accent/40` reads correctly in the source and paints nothing.
     Thirty-three of them were being dropped that way, including the dimming
     behind two modals. Proving one survived into the stylesheet proves the
     indirection is intact in the build the browser actually got. */
  record(
    /rgb\(var\(--[a-z0-9-]+-rgb,[^)]*\)\s*\/\s*\.\d+\)/.test(css),
    'an opacity modifier still resolves',
  );
}

// ── the dependency added this release is actually installed ─────────────────
function checkDeps() {
  const installed = existsSync(join(root, 'node_modules', '@anthropic-ai', 'sdk'));
  record(installed, 'the concierge SDK is installed', installed ? '' : 'run: npm ci');
}

async function main() {
  console.log(`\nchecking ${base}\n`);

  checkDeps();
  checkBuiltCss();

  // public
  const home = await page('/', 'the public site answers');
  if (home) {
    const html = await home.text();
    record(html.includes('רגע מאושר שישאר לנצח'), 'the headline is on the page');
    record(html.includes('apple-mobile-web-app-capable'), 'the tag an installed app needs');
    record(html.includes('/manifest.webmanifest'), 'the manifest is linked');
  }
  await page('/login', 'sign in answers');
  await page('/install', 'the install guide answers');
  await page('/offline', 'the offline page answers');

  /* Installed, this is what names the icon on somebody's home screen. It is
     served rather than static now, so it can carry a producer's own name, and
     a route that 404s is an install that half works. */
  const mani = await page('/manifest.webmanifest', 'the manifest is served', { expect: [200] });
  if (mani) {
    const j = await mani.json().catch(() => null);
    record(j?.display === 'standalone', 'it installs as an app, not a tab', String(j?.display));
    record(j?.dir === 'rtl' && j?.lang === 'he', 'it is Hebrew and right to left', `${j?.lang}/${j?.dir}`);
    const sizes = (j?.icons ?? []).map((i) => i.sizes);
    record(
      sizes.includes('192x192') && sizes.includes('512x512'),
      'both icon sizes are declared',
      sizes.join(' '),
    );
  }
  /* Linked from every invitation, so it has to work for somebody who has
     never signed in and may never sign in on the device they are holding. */
  await page('/auth/callback?email=a%40b.co', 'a spent link lands somewhere useful', { expect: [307, 308] });

  /* A calendar app fetches this from its own servers with no cookies. The
     failure it guards against is silent by design: handed a sign-in redirect,
     the app parses the HTML, finds no events, and reports that it subscribed.
     So an unknown token must answer 200 with a real, empty calendar. */
  const feed = await page(
    '/feed/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.ics',
    'a calendar app gets a calendar and not a login page',
    { expect: [200] },
  );
  if (feed) {
    const body = await feed.text();
    record(
      feed.headers.get('content-type')?.includes('text/calendar') && body.replace(/\r/g, '').startsWith('BEGIN:VCALENDAR'),
      'an unknown feed token is empty rather than a redirect',
      body.slice(0, 15).replace(/[\r\n]/g, ' '),
    );
  }

  // behind the sign in: a redirect is the correct answer to a stranger
  for (const [path, label] of [
    ['/app', 'the overview'],
    ['/app/clients', 'the event list'],
    ['/app/leads', 'leads'],
    ['/app/calendar', 'the calendar'],
    ['/app/insights', 'the numbers'],
    ['/app/brand', 'the branding editor'],
    ['/app/vendors', 'the vendor book'],
    ['/app/sop', 'the playbook'],
    ['/app/site', 'the site editor'],
    ['/app/portal', "the couple's area"],
  ]) {
    await page(path, label);
  }

  // the concierge answers even with no key, which is the whole design
  try {
    const res = await fetch(`${base}/api/ai-concierge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'בדיקה' }] }),
    });
    const data = await res.json();
    record(res.status === 200 && typeof data.reply === 'string', 'the concierge replies',
      data.off ? 'no key set, so it points at WhatsApp' : 'answering');
  } catch (e) {
    record(false, 'the concierge replies', e.message);
  }

  // the lead webhook refuses an unauthenticated delivery
  try {
    const res = await fetch(`${base}/api/leads/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ full_name: 'verify', phone: '0500000000' }),
    });
    record([401, 503].includes(res.status), 'the lead webhook refuses strangers',
      res.status === 503 ? 'no key configured, so it refuses everything' : `→ ${res.status}`);
  } catch (e) {
    record(false, 'the lead webhook refuses strangers', e.message);
  }

  const width = Math.max(...results.map((r) => r.label.length));
  for (const r of results) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.label.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
