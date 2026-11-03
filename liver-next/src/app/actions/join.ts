'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabasePublic } from '@/lib/supabase/public';
import { supabaseServer } from '@/lib/supabase/server';
import { joinProblems, TERMS_VERSION } from '@/lib/campaign';
import { joinFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';

/**
 * The two ways in through a conference code.
 *
 * `leaveDetails` has no account behind it: it checks the form, drops anything
 * a bot filled in, and hands the rest to a database function that checks the
 * code, the ceiling and the terms again. `joinWithAccount` is the same form
 * from somebody signed in with Google, where the address is the account's own
 * and the database approves the account if the code allows it.
 *
 * The browser never says which version of the terms was accepted; the version
 * is a constant here, so the record is of what the page actually showed.
 */

export type JoinResult = { ok: boolean; error?: string; fields?: string[] };

function read(form: FormData) {
  return {
    token: String(form.get('token') ?? ''),
    name: String(form.get('name') ?? '').trim().slice(0, 120),
    phone: String(form.get('phone') ?? '').trim().slice(0, 30),
    email: String(form.get('email') ?? '').trim().slice(0, 200),
    terms: form.get('terms') === 'on',
    list: form.get('list') === 'on',
    trap: String(form.get('website') ?? ''),
  };
}

export async function leaveDetails(_prev: JoinResult | null, form: FormData): Promise<JoinResult> {
  const c = joinFor(await currentLocale());
  const f = read(form);
  /* A real person never sees this field. Answering as though it worked keeps a
     bot from learning that it was spotted. */
  if (f.trap) return { ok: true };

  const problems = joinProblems(f);
  if (problems.length > 0) {
    return { ok: false, error: c.problems[problems[0]], fields: problems };
  }

  const { error } = await supabasePublic().rpc('campaign_contact', {
    p_token: f.token, p_name: f.name, p_phone: f.phone, p_email: f.email,
    p_terms_version: TERMS_VERSION, p_broadcast: f.list,
  });
  if (error) {
    console.error('[join] could not save a contact', { code: error.code, message: error.message });
    return { ok: false, error: /not active/.test(error.message) ? c.badLink : c.failed };
  }
  return { ok: true };
}

export async function joinWithAccount(_prev: JoinResult | null, form: FormData): Promise<JoinResult> {
  const c = joinFor(await currentLocale());
  const f = read(form);
  if (f.trap) return { ok: true };

  /* The address is the account's, so it is not asked for and not checked. */
  const problems = joinProblems({ ...f, email: 'account@account.account' }).filter((p) => p !== 'email');
  if (problems.length > 0) {
    return { ok: false, error: c.problems[problems[0]], fields: problems };
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('join_campaign', {
    p_token: f.token, p_name: f.name, p_phone: f.phone,
    p_terms_version: TERMS_VERSION, p_broadcast: f.list,
  });
  if (error || typeof data !== 'string') {
    console.error('[join] could not join', { code: error?.code, message: error?.message });
    return { ok: false, error: /not active/.test(error?.message ?? '') ? c.badLink : c.failed };
  }
  revalidatePath('/app', 'layout');
  /* Whatever the account is now, /app knows where it belongs. */
  redirect('/app');
}
