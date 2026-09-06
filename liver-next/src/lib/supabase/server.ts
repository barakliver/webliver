import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Request-scoped client that carries the signed-in user, so every query runs
 * under that user's row level security policies.
 *
 * One per render rather than one per caller. There are a hundred and forty-six
 * call sites and a busy screen reaches a dozen of them, each building another
 * client over the same cookie jar — no round trips, but allocation and garbage
 * on a machine with a gigabyte of memory, and it made every downstream memo
 * useless: a helper taking `sb` as an argument could never match a previous
 * call, because the argument was a different object every time.
 *
 * Request-scoped is what the name already claimed and what Supabase's own
 * guidance for this framework describes. `cache` makes it true.
 */
export const supabaseServer = cache(async function supabaseServer() {
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
})
