'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

/**
 * How a producer wants to be told, and the browsers that telling reaches.
 *
 * Every write here is the signed-in person's own row: the policies on both
 * tables say `profile_id = auth.uid()` and nothing else, so there is no
 * workspace to check and nothing to attribute. What there is to get right is
 * the shape of a refusal, which is a result and never a silent return.
 */

export type NotifyResult = { ok: true } | { ok: false; error: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveNotifyPrefs(_prev: NotifyResult | null, form: FormData): Promise<NotifyResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'לא מחוברים' };

  const v = (k: string) => String(form.get(k) ?? '').trim();
  const wa = v('whatsapp_number');
  if (wa && !normalizePhone(wa)) return { ok: false, error: 'מספר הוואטסאפ לא נראה כמו מספר' };

  const quiet = v('quiet') === 'on';
  const start = v('quiet_start');
  const end = v('quiet_end');
  if (quiet && (!TIME.test(start) || !TIME.test(end))) {
    return { ok: false, error: 'שעות השקט צריכות שעת התחלה ושעת סיום' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('notification_preferences').upsert({
    profile_id: account.id,
    whatsapp_number: wa ? (normalizePhone(wa) ?? wa) : '',
    push_enabled: v('push_enabled') !== 'off',
    quiet_start: quiet ? start : null,
    quiet_end: quiet ? end : null,
  }, { onConflict: 'profile_id' });
  if (error) {
    console.error('[notify] prefs failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }
  revalidatePath('/app/me');
  return { ok: true };
}

/** A browser said yes. The subscription object is what the browser gave,
 *  stored as the three strings Web Push needs and nothing else. */
export async function savePushSubscription(form: FormData): Promise<NotifyResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'לא מחוברים' };

  let sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try { sub = JSON.parse(String(form.get('subscription') ?? '')); } catch {
    return { ok: false, error: 'הדפדפן לא החזיר מנוי' };
  }
  const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return { ok: false, error: 'הדפדפן לא החזיר מנוי' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('push_subscriptions').upsert({
    profile_id: account.id, endpoint, p256dh, auth,
    user_agent: String(form.get('user_agent') ?? '').slice(0, 300),
    gone_at: null,
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error('[notify] subscription failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לרשום את המכשיר' };
  }
  revalidatePath('/app/me');
  return { ok: true };
}

export async function removePushSubscription(form: FormData): Promise<NotifyResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'לא מחוברים' };
  const endpoint = String(form.get('endpoint') ?? '');
  if (!endpoint) return { ok: false, error: 'חסר מנוי' };
  const sb = await supabaseServer();
  const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) {
    console.error('[notify] unsubscribe failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו להסיר' };
  }
  revalidatePath('/app/me');
  return { ok: true };
}
