import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * A client with no session, for reading things anybody may read.
 *
 * The request-scoped client reads cookies, and reading cookies opts a route out
 * of static rendering entirely. That is the right trade on a signed-in page and
 * the wrong one on the homepage: the marketing page went from prerendered to a
 * database round trip per visitor, and the only thing it needed was a table
 * whose select policy is `true`.
 *
 * So this one carries the publishable key and nothing else. It is anon, which
 * is exactly the role the visitor would have had anyway, and it leaves the page
 * cacheable.
 */
export function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
