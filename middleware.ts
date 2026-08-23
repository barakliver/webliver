import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isRootHost, normalizeHost, parseRootHosts } from '@/lib/domain/hosts';

/**
 * Multi-tenant edge middleware.
 *
 * Two jobs on every request:
 *   1. Refresh the Supabase session. Without this, access tokens expire and
 *      users are silently signed out mid-session.
 *   2. Resolve the hostname to a producer tenant and hand the result to the
 *      server components as request headers.
 *
 * Tenant resolution goes through the `resolve_tenant` RPC, which returns public
 * brand identity only — never anything that identifies a couple or a guest.
 */

export interface TenantIdentity {
  id: string;
  slug: string;
  brand_name: string;
  logo_url: string | null;
  color_ink: string;
  color_accent: string;
  color_paper: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  website_url: string | null;
  tier: 'diy' | 'managed' | 'agency';
}

/** Header names the app reads downstream. */
export const TENANT_HEADER = 'x-tenant';
export const TENANT_HOST_HEADER = 'x-tenant-host';

/**
 * Per-instance cache. Edge instances are short-lived and numerous, so this is a
 * best-effort hit-rate improvement, not a correctness mechanism — a suspended
 * producer stops resolving within TTL at the latest.
 */
const ROOT_HOSTS = parseRootHosts(process.env.NEXT_PUBLIC_ROOT_HOSTS);

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: TenantIdentity | null; at: number }>();

async function resolveTenant(host: string): Promise<TenantIdentity | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/resolve_tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_host: host }),
    });
    if (!res.ok) {
      cache.set(host, { value: null, at: Date.now() });
      return null;
    }
    const data = (await res.json()) as TenantIdentity | null;
    const value = data && data.id ? data : null;
    cache.set(host, { value, at: Date.now() });
    return value;
  } catch {
    // A resolution failure must not take the site down: fall through to the
    // platform experience rather than erroring the request.
    return null;
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: new Headers(request.headers) } });

  // ── 1 · session refresh ────────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    });
    // getUser() revalidates the token with the auth server; getSession() would
    // trust whatever the cookie claims.
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  // ── 2 · tenant resolution ──────────────────────────────────────────────
  const host = normalizeHost(request.headers.get('host'));
  const tenant = isRootHost(host, ROOT_HOSTS) ? null : await resolveTenant(host);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HOST_HEADER, host);
  if (tenant) requestHeaders.set(TENANT_HEADER, JSON.stringify(tenant));
  else requestHeaders.delete(TENANT_HEADER);

  // ── 3 · route guards ───────────────────────────────────────────────────
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith('/workspace') || path.startsWith('/dashboard') || path.startsWith('/admin');

  if (isProtected && !user) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  // Platform governance is never reachable from a producer's own domain — that
  // surface belongs to the platform host only. Authorization itself is enforced
  // in the page and again in every admin RPC.
  if (path.startsWith('/admin') && tenant) {
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  const next = NextResponse.next({ request: { headers: requestHeaders } });
  // Carry over any refreshed auth cookies.
  for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
  return next;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the service worker — the SW must be
     * served from the origin root untouched or its scope breaks.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/).*)',
  ],
};
