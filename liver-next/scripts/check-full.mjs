/**
 * The two checks that need a running product, run against one.
 *
 *     node scripts/check-full.mjs
 *
 * `check-a11y.mjs` and `check-hydration.mjs` have both existed for months and
 * neither had ever run. Not because they were broken — because each needs a
 * `--url` and a server behind it, so neither could go into `npm run check`,
 * and a check that is not in the one command somebody types is a check that
 * does not exist. They were the second instance of the same failure as the
 * contrast script, which spent two redesigns measuring a palette nobody could
 * see: a green suite that was green about nothing.
 *
 * So this boots the product, waits for it to answer, runs both against it and
 * puts it away again. One command, no arguments, nothing to remember.
 *
 * It runs `next dev` rather than a built server on purpose. `/design` is the
 * page both checks lean on hardest — it mounts nearly every component in the
 * product with fixtures, so one load covers what would otherwise need an
 * account and twenty clicks — and `/design` is gated on `NODE_ENV` and does
 * not exist in a production build. A standing server would check the product
 * minus the page that is worth checking.
 *
 * Deliberately NOT part of `npm run check`. That command is the gate somebody
 * runs before every commit, it finishes in seconds, and bolting a dev server
 * and two browser passes onto it would make the fast check slow enough to
 * skip. This is the longer one, run before a release.
 *
 * Read only: it starts a server, loads pages, and reports. Playwright is not
 * a dependency of this project, so when it is missing both checks say so and
 * exit cleanly, and so does this.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* Not 3000. Somebody running this very often has the product open in another
   terminal, and a check that fails because the real server is up is a check
   that teaches people to stop running it. */
const PORT = Number(process.env.CHECK_PORT ?? 3123);
const base = `http://127.0.0.1:${PORT}`;

/* Long, because this is a cold `next dev`: the first request compiles the
   route, and /design is the largest page in the product. */
const BOOT_MS = 180_000;

if (!existsSync(join(root, '.env.local')) && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  /* The client throws at module scope without these, so the page would render
     a crash and both checks would report on it as if it were the product. */
  console.error('\nno .env.local and no NEXT_PUBLIC_SUPABASE_URL: the browser client cannot start.');
  console.error('placeholders are enough for the harness — this check never talks to a real database.\n');
  process.exit(1);
}

const run = (cmd, args, opts = {}) => new Promise((resolve) => {
  const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
  p.on('exit', (code) => resolve(code ?? 1));
});

async function answers(url, within) {
  const until = Date.now() + within;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

console.log(`\nstarting the product on ${base} …`);
const server = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
  cwd: root,
  stdio: 'ignore',
  /* Its own group, so the teardown below reaches the compiler it spawns and
     does not leave a server holding the port until somebody notices. */
  detached: true,
  env: { ...process.env, NODE_ENV: 'development' },
});

let stopped = false;
const stop = () => {
  if (stopped || server.pid === undefined) return;
  stopped = true;
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
};
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

/* The first load of /design is the slow one, so wait on that rather than on
   the home page: a check that starts while the route is still compiling times
   out inside Playwright and reads as a failure of the product. */
if (!await answers(`${base}/design`, BOOT_MS)) {
  stop();
  console.error(`\nthe product did not answer on ${base} within ${BOOT_MS / 1000}s.\n`);
  process.exit(1);
}
console.log('up.\n');

const a11y = await run('node', [join(here, 'check-a11y.mjs'), '--url', base]);
const hydration = await run('node', [join(here, 'check-hydration.mjs'), '--url', base]);

stop();

const bad = a11y || hydration;
console.log(bad ? '\nthe long check found something.\n' : '\nthe long check is clean.\n');
process.exit(bad ? 1 : 0);
