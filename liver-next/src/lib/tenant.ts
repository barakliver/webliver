/**
 * Which producer a request is for.
 *
 * Pure host arithmetic, kept out of the middleware so it can be checked
 * without standing up a server. The middleware does the fetching; this decides
 * what to fetch and what a host even means.
 *
 * Three shapes of request arrive:
 *
 *   the platform's own site        liverproduction.com, www., localhost
 *   a producer's subdomain         keren.liverproduction.com
 *   a producer's own domain        events.keren-weddings.com
 *
 * The distinction matters because a subdomain is looked up by its first label
 * and a custom domain by the whole host, and getting that backwards means a
 * producer whose slug happens to be "app" answers on the platform's own app
 * subdomain.
 */

/** Hosts that are the platform itself and never a tenant. */
const PLATFORM_LABELS = new Set(['www', 'app', 'api', 'admin', 'staging', 'preview']);

/** Set in the environment so a staging deploy on a different root domain does
 *  not read every subdomain of it as a tenant. */
export const platformRoot = (env = process.env.NEXT_PUBLIC_ROOT_DOMAIN): string =>
  (env ?? '').trim().toLowerCase().replace(/^www\./, '');

export type Tenant =
  /** The platform's own pages. */
  | { kind: 'platform' }
  /** A producer's subdomain under the platform root. */
  | { kind: 'slug'; value: string }
  /** A domain a producer pointed here themselves. */
  | { kind: 'domain'; value: string };

/** A hostname, stripped of the parts a Host header carries and a lookup does
 *  not: the port, the case, and a leading www. */
export function cleanHost(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
}

/**
 * Local development and previews are never a tenant.
 *
 * Deliberately generous: a wrong answer here sends a developer's localhost to
 * a database lookup that will not resolve and leaves them staring at an
 * unbranded page wondering what broke.
 */
export function isLocal(host: string): boolean {
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '[::1]'
    || host.endsWith('.local')
    || host.endsWith('.localhost')
    || /^\d+\.\d+\.\d+\.\d+$/.test(host)
    || host.endsWith('.vercel.app');
}

export function tenantOf(rawHost: string | null | undefined, root = platformRoot()): Tenant {
  const host = cleanHost(rawHost);
  if (!host || isLocal(host)) return { kind: 'platform' };

  /* No root configured means single-tenant, which is what this is until
     somebody sets one. Treating every host as a tenant in that state would
     send the platform's own site through a lookup that returns nothing. */
  if (!root) return { kind: 'platform' };

  if (host === root) return { kind: 'platform' };

  if (host.endsWith('.' + root)) {
    const label = host.slice(0, -(root.length + 1));
    /* Only a single label. `a.b.root` is not a tenant, it is a mistake, and
       reading `a` out of it would route somebody's typo to a real producer. */
    if (label.includes('.') || PLATFORM_LABELS.has(label)) return { kind: 'platform' };
    return { kind: 'slug', value: label };
  }

  return { kind: 'domain', value: host };
}

/** What the middleware passes to the database, which is the whole host for a
 *  custom domain and just the label for a subdomain. */
export function lookupKey(t: Tenant): string | null {
  return t.kind === 'platform' ? null : t.value;
}
