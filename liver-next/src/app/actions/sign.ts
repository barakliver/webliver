'use server';

import { revalidatePath } from 'next/cache';
import { supabasePublic } from '@/lib/supabase/public';
import { signCopy } from '@/content/site';

export type SignResult = { ok: boolean; error?: string };

/**
 * Signing from a link, by somebody with no account.
 *
 * Through the public client, which carries no session, because there is no
 * session here to carry. The token is the credential and the database function
 * behind this is the only thing that can act on it.
 *
 * Every refusal comes back as the same sentence. A message that separated
 * "already signed" from "no such agreement" would confirm a guess to whoever
 * was guessing, and the one honest exception is a name too short to be one,
 * which is the person's own input and worth telling them about.
 */
export async function signByLink(_prev: SignResult | null, form: FormData): Promise<SignResult> {
  const token = String(form.get('token') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();

  if (!token) return { ok: false, error: signCopy.failed };
  if (name.length < 2) return { ok: false, error: signCopy.short };

  const sb = supabasePublic();
  const { error } = await sb.rpc('sign_contract_by_token', { p_token: token, p_name: name });

  if (error) {
    console.error('[sign] refused', { code: error.code, message: error.message });
    if (/בשם מלא/.test(error.message)) return { ok: false, error: signCopy.short };
    return { ok: false, error: signCopy.failed };
  }

  /* The same page, which now renders the signed state rather than the form. */
  revalidatePath(`/sign/${token}`);
  return { ok: true };
}
