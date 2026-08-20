'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type RsvpResult = { ok: boolean; error?: string; status?: 'attending' | 'declined' };

/** A guest has no account, so this goes through the token function rather
 *  than the guest table, which stays closed to anonymous callers. */
export async function submitRsvp(_prev: RsvpResult | null, form: FormData): Promise<RsvpResult> {
  const token = String(form.get('token') ?? '').trim();
  const statusRaw = String(form.get('status') ?? '');
  const status = statusRaw === 'attending' ? 'attending' : statusRaw === 'declined' ? 'declined' : null;

  if (!token) return { ok: false, error: 'הקישור לא תקין' };
  if (!status) return { ok: false, error: 'נא לבחור אם אתם מגיעים' };

  const size = Number(String(form.get('party_size') ?? '1'));
  const partySize = Number.isFinite(size) ? Math.min(20, Math.max(1, Math.round(size))) : 1;

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('rsvp_respond', {
    p_token: token,
    p_status: status,
    p_party_size: partySize,
    p_diet: String(form.get('diet') ?? 'none'),
    p_note: String(form.get('note') ?? '').slice(0, 500),
  });

  if (error) return { ok: false, error: 'לא הצלחנו לשמור את התשובה. נסו שוב.' };
  /* the function answers false for a token that matched nothing, which is a
     wrong or withdrawn link rather than a failure to save */
  if (data !== true) return { ok: false, error: 'הקישור כבר לא בתוקף. פנו לזוג.' };

  return { ok: true, status };
}
