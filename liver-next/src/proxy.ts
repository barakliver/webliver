import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { tenantOf, lookupKey, surfaceOf } from '@/lib/tenant';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** The header the tenant travels in. Read by the layout, and stripped from
 *  anything arriving from outside so a request cannot claim to be a tenant it
 *  is not by simply setting it. */
export const TENANT_HEADER = 'x-liver-tenant';
export const TENANT_KIND_HEADER = 'x-liver-tenant-kind';

/** Supabase access tokens are short lived. Without a refresh on the way past,
 *  a signed-in user is bounced to the login screen the moment their token
 *  expires, even though their session is perfectly valid.
 *
 *  This is also where a request is matched to a producer. Only the decision is
 *  made here — which host means which tenant — and it travels onward as a
 *  header for the layout to resolve. Doing the database lookup in middleware
 *  would put a round trip in front of every image, and doing the routing in a
 *  page would mean each page had to remember to. */
export default async function proxy(request: NextRequest) {
  /* Headers are rebuilt rather than passed through. A client that sends
     x-liver-tenant itself would otherwise pick its own branding, and on a
     platform whose whole promise is tenant isolation that is not a header to
     take on trust. */
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.delete(TENANT_KIND_HEADER);

  const tenant = tenantOf(request.headers.get('host'));
  const tenantKey = lookupKey(tenant);
  if (tenantKey) {
    headers.set(TENANT_HEADER, tenantKey);
    headers.set(TENANT_KIND_HEADER, tenant.kind);
  }

  /* The app subdomain's front door.
   *
   * Routing in this app is by path, so `/` is the marketing home on whatever
   * host answers it — which means app.beforeidoevent.com would serve the
   * shopfront. One rewrite fixes that, and deliberately only that one: every
   * other path is left alone, so a deep link into the console works, and so
   * does /login, and so does every token link already sitting in somebody's
   * WhatsApp if it ever arrives there.
   *
   * A rewrite rather than a redirect, because the address a producer typed is
   * the address they should keep. And it does nothing at all until
   * NEXT_PUBLIC_ROOT_DOMAIN is set, which is what makes it safe to ship
   * before any DNS moves.
   *
   * It does NOT return early, and that is the whole care in this block. The
   * token refresh below is the reason this function runs at all; a path that
   * skips it is a path where a signed-in producer is thrown to the login
   * screen the moment their access token expires — on the console's own front
   * page, which is the one address they keep open. So the rewrite only
   * decides which response object the rest of the function fills in. */
  const toConsole = request.nextUrl.pathname === '/'
    && surfaceOf(request.headers.get('host')) === 'console';

  /* What the request is really for, once the rewrite is taken into account.
     The guard at the bottom has to read this rather than the address bar, or
     the console's front page is the one page in the product that is not
     behind the sign-in. */
  const pathname = toConsole ? '/app' : request.nextUrl.pathname;

  let response: NextResponse;
  if (toConsole) {
    const to = request.nextUrl.clone();
    to.pathname = '/app';
    response = NextResponse.rewrite(to, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: CookieToSet[]) => {
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && pathname.startsWith('/app')) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.searchParams.set('next', pathname);
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  /* everything except static assets, so the token is refreshed on real
     navigations without paying for it on every image request */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|mp4)$).*)'],
};
