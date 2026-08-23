/**
 * Hostname classification for multi-tenant routing.
 *
 * Pure and dependency-free so the edge middleware and the tests can share it.
 */

export function parseRootHosts(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? 'localhost,127.0.0.1,liver.app,www.liver.app')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Strips the port and lowercases. `Events.Example.com:3000` -> `events.example.com`. */
export function normalizeHost(raw: string | null | undefined): string {
  return (raw ?? '').split(':')[0]!.trim().toLowerCase();
}

/** True when the host serves the platform itself rather than a producer portal. */
export function isRootHost(host: string, rootHosts: Set<string>): boolean {
  if (!host) return true;
  if (rootHosts.has(host)) return true;
  // Preview deployments serve the platform, never a tenant.
  return host.endsWith('.vercel.app');
}

/** The subdomain label a tenant slug would be matched against. */
export function subdomainLabel(host: string): string {
  return host.split('.')[0] ?? '';
}
