'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/* One client for the whole tab.
 *
 * createBrowserClient builds a fresh instance every call, and each instance
 * opens its own websocket the moment anything subscribes. With a hook on the
 * layout and another on the page that is two sockets per screen, two sets of
 * retries when the network drops, and two copies of every event. Holding one
 * instance per tab keeps it to a single connection that every subscription
 * multiplexes over — which is what the Realtime protocol is built for. */
let cached: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cached;
}
