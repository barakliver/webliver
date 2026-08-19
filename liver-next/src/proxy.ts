import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Supabase access tokens are short lived. Without a refresh on the way past,
 *  a signed-in user is bounced to the login screen the moment their token
 *  expires, even though their session is perfectly valid. */
export default async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

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

  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  /* everything except static assets, so the token is refreshed on real
     navigations without paying for it on every image request */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|mp4)$).*)'],
};
