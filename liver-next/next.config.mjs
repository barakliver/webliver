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

  experimental: {
    serverActions: {
      /* A server action is a request body, and the default ceiling on one is a
         single megabyte. Every photograph taken on a phone in the last decade
         is larger than that, which means the moodboard upload — an 8MB limit
         written into the action, carefully, with its own message — was being
         refused by the framework before the action ever ran. The error never
         reached the screen either; it is a 413 on the action endpoint, so the
         upload simply did nothing.

         The shared folder does not go through here at all: it uploads straight
         from the browser to storage, under the couple's own session, where the
         same row level policies decide whether it may. This ceiling is for the
         paths that still post a file to the server. */
      bodySizeLimit: '12mb',

      /* Behind Caddy the browser's Origin is the public host while the app
         sees a request forwarded to localhost, and Next logs
         "Missing 'origin' header from a forwarded Server Actions request" and
         refuses. Naming the real hosts is what that check is for. */
      allowedOrigins: [
        'liverproductions.com',
        'www.liverproductions.com',
      ],
    },
  },

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
