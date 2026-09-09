import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { required } from '@/lib/env';

/** Service-role client. Bypasses row level security, so it is used only for
 *  work the public genuinely cannot do as itself: writing an inbound lead,
 *  issuing a reset code, provisioning a client workspace. */
export function supabaseAdmin() {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
