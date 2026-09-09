import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Request-scoped client that carries the signed-in user, so every query runs
 *  under that user's row level security policies. */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list: CookieToSet[]) => {
          try {
            list.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* called during a Server Component render, where cookies are read
               only; the middleware refresh path writes them instead */
          }
        },
      },
    }
  );
}
