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

/**
 * Did the page actually draw anything?
 *
 * This is the check that was missing, and its absence is why a deploy could
 * report sixty-two passes while six screens were blank. Every check above asks
 * the server for a status code, and a shell whose main region rendered nothing
 * answers 200 with a perfectly healthy header, menu and footer wrapped around
 * an empty hole. The status code is the server's opinion of itself.
 *
 * So: find the main region and count what is inside it once the tags are gone.
 * A screen that has been reduced to its chrome has a nearly empty one. The
 * threshold is deliberately low — enough to catch nothing at all rather than
 * to have views about how wordy a page should be.
 *
 * A redirect is not a failure here for the same reason it is not above: every
 * screen behind the sign-in is supposed to turn a stranger away.
 */
function mainText(html) {
  const m = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (!m) return null;
  return m[1]
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_MAIN = 40;

async function renders(path, label) {
  let res;
  try {
    res = await fetch(base + path, { redirect: 'manual' });
  } catch (e) {
    return record(false, label, `${path} → ${e.message}`);
  }

  if (res.status === 307 || res.status === 308) {
    return record(true, label, `${path} → ${res.status}, sent to the door`);
  }
  if (res.status !== 200) {
    return record(false, label, `${path} → ${res.status}`);
  }

  const body = mainText(await res.text());
  if (body === null) {
    return record(false, label, `${path} → 200 but no <main> at all`);
  }
  record(
    body.length >= MIN_MAIN,
    label,
    body.length >= MIN_MAIN
      ? `${path} → ${body.length} characters drawn`
      : `${path} → 200 with an empty main region (${body.length} characters)`,
  );
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
  record(/--surface-rgb:\s*241 245 249/.test(css), 'the ground is in the build');
  record(/--ink-rgb:\s*15 23 42/.test(css), 'the ink is in the build');
  record(/--accent-rgb:\s*130 104 64/.test(css), 'the measured gold is in the build');

  /* And the two palettes it replaced. The ground is slate again, deliberately,
     but these are the *first* app's values and neither belongs in a build of
     this one: a blue-grey page ground and a blue accent. The accent here is
     gold on every palette this product has ever shipped. */
  record(!has('#f3f6fa'), 'the old page ground is gone');
  record(!has('#2e5f8c'), 'the blue accent is gone');

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

  record(has('--line-control'), 'control edges have their own token');

  /* The face, which is the one thing about this design that cannot be checked
     by looking at a screenshot on a phone. This assertion has flipped once:
     the handoff file set everything in Heebo and for a while this checker
     refused a build carrying the serif. Then he ruled on it himself - the
     font he named is the one in MASTER.md, Frank Ruhl Libre for display - and
     the layout loads it again. So its variable must be in the stylesheet; a
     build without it has quietly reverted to the wrong design. */
  record(has('--font-frank'), 'the serif is in the build');

  /* And the surfaces. A card in this design is glass: a translucent fill, a
     soft edge and a 24px corner. Its absence is what a flat page looks like. */
  record(/backdrop-filter:\s*blur/.test(css), 'panels are glass rather than flat');
  record(/border-radius:\s*24px/.test(css), 'a card has the design\'s own corner');

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

/**
 * Wait for the thing being checked to be listening.
 *
 * `systemctl restart` returns as soon as systemd has started the unit, and the
 * server needs a moment after that to bind. Run straight afterwards, every
 * fetch here fails with a refused connection — instantly, so all twenty land
 * inside the gap and the report reads like a broken deploy rather than a
 * checker that was early. That happened, and it cost a round of debugging a
 * server that was fine.
 *
 * Thirty seconds, then give up and let the checks report what they find. A
 * server that has not bound in thirty seconds is a real failure and should be
 * reported as one rather than waited on forever.
 */
async function waitForServer(seconds = 30) {
  const until = Date.now() + seconds * 1000;
  let waited = false;
  for (;;) {
    try {
      await fetch(base, { redirect: 'manual', signal: AbortSignal.timeout(2000) });
      if (waited) console.log('');
      return true;
    } catch {
      if (Date.now() >= until) {
        console.log(`\n  ${base} did not answer within ${seconds}s\n`);
        return false;
      }
      if (!waited) { process.stdout.write('  waiting for the server'); waited = true; }
      else process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function main() {
  console.log(`\nchecking ${base}\n`);

  await waitForServer();

  checkDeps();
  checkBuiltCss();

  // public
  const home = await page('/', 'the public site answers');
  if (home) {
    const html = await home.text();
    /* His line, word for word. It is the headline and it is now on a handful
       of other screens, all from one constant, so this checks the sentence
       rather than the markup around it. A comma moved here is a comma moved
       in something that is not ours to edit. */
    record(html.includes('רגע מאושר שישאר לנצח'), 'the promise is on the page, word for word');
    record(html.includes('apple-mobile-web-app-capable'), 'the tag an installed app needs');
    record(html.includes('/manifest.webmanifest'), 'the manifest is linked');
  }
  /* The shopfront is a public page like the homepage, and it renders whether
     or not anything is for sale — an empty shop says so rather than 500ing,
     which is the state it will be in on the day it ships. */
  await page('/store', 'the shop answers', { expect: [200] });

  /* Google refuses to publish an application whose consent screen has no
     privacy policy behind it, so this page is load bearing rather than
     decorative: a 404 here is a sign-in button that stops working. */
  await page('/privacy', 'the privacy policy answers', { expect: [200] });
  await page('/app/clients/archive', 'the archive shelf', { expect: [200, 307] });
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
  /* The page a supplier opens from a link, with no account and no session. It
     has to answer for a stranger, and a token that is not one has to look
     exactly like a token that has been withdrawn. Anything else confirms a
     guess to whoever is guessing. */
  const bad = await page(
    '/sign/0000000000000000000000000000000000000000000000000000',
    'a signing link answers a stranger',
    { expect: [200] },
  );
  if (bad) {
    const html = await bad.text();
    record(
      html.includes('הקישור הזה כבר לא פעיל'),
      'an unknown signing token looks exactly like a withdrawn one',
    );
  }

  /* The guests' page, this release's new public surface. Same rule as the
     signing link: a token nobody minted must read exactly like a page that is
     switched off, so the two are indistinguishable from outside. */
  const guest = await page(
    '/w/00000000000000000000000000000000',
    'the guests\' page answers a stranger',
    { expect: [200] },
  );
  if (guest) {
    const html = await guest.text();
    record(html.includes('הדף לא זמין'), 'an unknown guest token reads as not available');
  }
  /* The operating book sits behind sign in; a stranger is sent to the door. */
  await page('/app/guide', 'the operating book answers', { expect: [200, 307] });
  /* So does the list of reports, which is the root account's alone. */
  await page('/app/admin/tickets', 'the tickets list is behind the door', { expect: [307] });

  /* The manifest is asked for with credentials, or the installed app carries
     the platform's name on a producer's phone. The attribute is the whole
     fix, so it is the thing checked. */
  const front = await page('/', 'the home page answers', { expect: [200] });
  if (front) {
    const html = await front.text();
    const link = /<link[^>]+rel="manifest"[^>]*>/i.exec(html)?.[0] ?? '';
    record(/crossorigin="use-credentials"/i.test(link), 'the manifest link carries credentials', link.slice(0, 80));
  }
  const manifest = await page('/manifest.webmanifest', 'the manifest answers', { expect: [200] });
  if (manifest) {
    try {
      const m = await manifest.json();
      record(Array.isArray(m.icons) && m.icons.length > 0 && typeof m.name === 'string', 'the manifest has a name and icons');
    } catch (e) {
      record(false, 'the manifest has a name and icons', e.message);
    }
  }

  /* The producer's assistant reads events through a session. A stranger must
     be refused before the route so much as looks at the body. */
  try {
    const res = await fetch(`${base}/api/copilot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'בדיקה' }] }),
    });
    record(res.status === 403, 'the copilot refuses a stranger', `→ ${res.status}`);
  } catch (e) {
    record(false, 'the copilot refuses a stranger', e.message);
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

  /* The receipt reader spends money on somebody's behalf and writes into a
     budget, so the thing worth checking from outside is that a stranger cannot
     reach it at all. 401 unauthenticated, 503 with no key configured; a 200
     here would mean the door is open. */
  try {
    const res = await fetch(`${base}/api/receipt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: 'x', media_type: 'image/png', data: 'x' }),
    });
    record([401, 403, 503].includes(res.status), 'reading a receipt refuses strangers',
      res.status === 503 ? 'no key configured, so it refuses everything' : `→ ${res.status}`);
  } catch (e) {
    record(false, 'reading a receipt refuses strangers', e.message);
  }

  /* The nightly sweep closes other people's events and sends other people's
     greetings, with nobody signed in. The only thing checkable from out here
     is that it refuses a stranger — a 200 on this endpoint would be an open
     door onto every tenant at once. */
  try {
    const res = await fetch(`${base}/api/cron`, { method: 'POST' });
    record([401, 503].includes(res.status), 'the nightly sweep refuses strangers',
      res.status === 503 ? 'no key configured, so it refuses everything' : `→ ${res.status}`);
  } catch (e) {
    record(false, 'the nightly sweep refuses strangers', e.message);
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

  /* The shared folder is the one feature whose bytes never touch this server:
     the browser uploads straight to storage under the couple's own session.
     Which means nothing about it shows up in a server log, and the only thing
     checkable from out here is that the screen for it actually shipped —
     its copy is in the client bundle, and the tab it lives on is a real
     address rather than a 404. */
  {
    const chunks = [];
    const walk = (dir) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) chunks.push(full);
      }
    };
    walk(join(root, '.next', 'static'));
    const js = chunks.map((f) => readFileSync(f, 'utf8')).join('');
    record(js.includes('גוררים לכאן'), 'the shared folder shipped to the browser');
    /* Dragging is written on pointer events rather than the HTML drag and drop
       API, because `dragstart` never fires on a touch screen and this product
       is used on a phone. If a build ever ships the other one, the reorder
       silently stops working on every phone and nowhere else. */
    record(js.includes('onPointerDown') || js.includes('pointerdown'),
      'the drag works with a finger, not only a mouse');

    /* And that the old one is gone. The seating plan shipped on the HTML drag
       and drop API for months, which meant the one screen here that is
       genuinely a diagram somebody rearranges did nothing at all on a phone.
       `dataTransfer` is the fingerprint of that API; nothing in this app
       should carry it any more. */
    record(!js.includes('dataTransfer.setData'),
      'nothing still relies on a drag that a phone never starts');

    /* Signing in with Google must go through the callback this app owns, so
       the session is exchanged on the server and becomes a cookie. A build
       that sends people at Supabase's hosted redirect instead lands them back
       with the credential in a fragment, which is the failure the invitations
       were quietly hitting for months. */
    record(js.includes('signInWithOAuth'), 'google sign-in shipped');

    /* One door. Phone sign-in is closed in the action and gone from the
       screen; if the tab is ever back in a build, so is a corridor that ends
       in "SMS is unavailable" and an account that belongs to no event. */
    record(!js.includes('לשלוח קוד ב-SMS במקום'), 'sign-in asks for one thing, an address');

    /* The four meetings, as questions rather than as a free text box. */
    record(js.includes('פגישת טעימות'), 'the meeting questionnaires shipped');
    record(js.includes('/auth/callback'), 'and it comes back through our own callback');
    /* An upload that went through a server action would be refused by the
       framework at one megabyte, silently, before the action ran. If the
       component ever starts posting the file instead of putting it in the
       bucket, this is the line that notices. */
    record(/\.from\((["'])files\1\)/.test(js),
      'it uploads into the bucket rather than through the server');
  }

  /* Every primary route, asked the question a status code cannot answer.
     These are the exact screens that were reported blank, plus the public
     pages a visitor lands on first. Behind the sign-in they redirect, which
     passes; what would fail is a 200 with nothing drawn inside it. */
  for (const [path, label] of [
    ['/', 'the home page draws something'],
    ['/store', 'the shop draws something'],
    ['/login', 'sign in draws something'],
    ['/privacy', 'the privacy policy draws something'],
    ['/terms', 'the terms draw something'],
    ['/accessibility', 'the accessibility statement draws something'],
    ['/install', 'the install guide draws something'],
    ['/app', 'the workspace draws something'],
    ['/app/insights', 'insights draws something'],
    ['/app/store', 'the shop screen draws something'],
    ['/app/sop', 'the operating book draws something'],
    ['/app/guide', 'the guides draw something'],
    ['/app/brand', 'branding draws something'],
    ['/app/me', 'the profile draws something'],
    ['/app/leads', 'leads draws something'],
    ['/app/calendar', 'the diary draws something'],
    ['/app/vendors', 'suppliers draws something'],
  ]) {
    await renders(path, label);
  }

  /* An address that matches nothing has to be a page rather than the
     framework's own notice, and it has to say so with a 404 — a soft 404 that
     answers 200 is how a dead link stays in a search index. */
  const missing = await page('/no-such-page-exists', 'a wrong address answers 404', { expect: [404] });
  if (missing) {
    const html = await missing.text();
    record(html.includes('הכתובת הזאת לא מובילה לשום מקום'), 'and it is our own notice, in Hebrew');
  }

  const width = Math.max(...results.map((r) => r.label.length));
  for (const r of results) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.label.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
