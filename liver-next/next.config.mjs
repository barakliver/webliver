import { execSync } from 'node:child_process';

/**
 * One identifier per deploy, and the whole update problem hangs off it.
 *
 * An installed app is a copy of the site that somebody keeps. Without a version
 * it can compare against, it has no way to know a newer one exists: it opens,
 * restores whatever it had, and goes on serving that until it is deleted and
 * installed again. Which is exactly what was happening.
 *
 * The commit is the version. It is already the thing that changed, it is
 * available on the server at the moment of the build, and two builds of the
 * same commit produce the same id — so a rebuild that changes nothing does not
 * tell every installed app to reload for no reason.
 *
 * Falls back to the clock only where git is unavailable, which is a build from
 * a tarball rather than the normal path.
 */
function version() {
  if (process.env.NEXT_DEPLOYMENT_ID) return process.env.NEXT_DEPLOYMENT_ID;
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch {
    return `t${Date.now()}`;
  }
}

const id = version();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /* Next's own version skew protection. It stamps the id onto every asset URL
     and onto navigation responses, and when a running client sees a server
     answering with a different one it does a full page load instead of a
     client side navigation. That is the half of the problem that shows up as
     a screen that half works after a deploy: the page in the browser is asking
     for chunks that the new build no longer has. */
  deploymentId: id,
  generateBuildId: async () => id,

  /* The same id, readable from the browser, so the app can ask "is what I am
     running still what is being served". */
  env: { NEXT_PUBLIC_BUILD_ID: id },

  async headers() {
    return [
      {
        /* The service worker is the one file that must never be served from a
           cache. A browser holding yesterday's copy will not notice a new one
           for as long as it holds it, and the worker is what decides what
           everything else is allowed to do. */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
