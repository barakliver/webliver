'use server';

import { headers } from 'next/headers';
import { supabasePublic } from '@/lib/supabase/public';
import { checkLimit, visitorKeyFrom } from '@/lib/ai/limit';
import { normalizePhone } from '@/lib/phone';

export type FindResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'notFound' | 'tooMany' | 'bad' };

/**
 * A guest finds their own invitation from the shared page.
 *
 * Anonymous, by design: the page is pasted into a family WhatsApp group and
 * nobody there has an account. Two things keep it from being a phone-book
 * walk: the database function answers only for a page that is switched on
 * and returns nothing but that one guest's reply token, and this action is
 * rate limited per visitor with the same bucket the concierge uses, so a
 * script gets a polite "try later" long before it gets a name.
 */
export async function findInvite(token: string, phone: string): Promise<FindResult> {
  const verdict = checkLimit(visitorKeyFrom(await headers()));
  if (!verdict.ok) return { ok: false, reason: 'tooMany' };

  const normalized = normalizePhone(phone);
  if (!token || !normalized) return { ok: false, reason: 'bad' };

  try {
    const sb = supabasePublic();
    const { data, error } = await sb.rpc('guest_find', { p_token: token, p_phone: normalized });
    if (error) {
      console.error('[guest site] find failed', error);
      return { ok: false, reason: 'notFound' };
    }
    const found = typeof data === 'string' ? data : Array.isArray(data) ? data[0] : null;
    return found ? { ok: true, token: String(found) } : { ok: false, reason: 'notFound' };
  } catch (e) {
    console.error('[guest site] find threw', e);
    return { ok: false, reason: 'notFound' };
  }
}
