import 'server-only';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { optional } from '@/lib/env';

/**
 * A push to every browser one person said yes in.
 *
 * Web Push and not an app store: the product is already installable, the
 * service worker is already there, and the one thing a notification needs
 * beyond that is a pair of VAPID keys in the server's environment. No
 * provider, no account, no monthly fee, and it reaches a phone on the home
 * screen the same way an app would.
 *
 * Three properties. It never throws: a push is best effort beside the row
 * that caused it. A browser that answers 404 or 410 has withdrawn its
 * subscription, and the row is marked gone rather than deleted, so the
 * settings screen can say "this phone stopped listening" instead of showing
 * nothing. And `configured()` is a question the settings screen can ask, so
 * a switch is not offered for a thing the server cannot do.
 */

export type PushNote = {
  title: string;
  body: string;
  /** Opened on tap, relative to the site. */
  url: string;
  /** Groups repeats: a second push with the same tag replaces the first. */
  tag?: string;
  /** No sound and no vibration: the quiet-hours shape. */
  silent?: boolean;
};

let vapidReady = false;

export function pushConfigured(): boolean {
  return Boolean(optional('VAPID_PUBLIC_KEY') && optional('VAPID_PRIVATE_KEY'));
}

function prepare(): boolean {
  if (vapidReady) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    optional('VAPID_SUBJECT', 'mailto:hello@liverproductions.com'),
    optional('VAPID_PUBLIC_KEY'),
    optional('VAPID_PRIVATE_KEY'),
  );
  vapidReady = true;
  return true;
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends to every live subscription of one profile. Returns how many were
 *  delivered and how many browsers turned out to be gone. */
export async function sendPush(
  sb: SupabaseClient, profileId: string, note: PushNote,
): Promise<{ sent: number; gone: number; error?: string }> {
  if (!prepare()) return { sent: 0, gone: 0, error: 'push not configured' };

  const { data, error } = await sb
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('profile_id', profileId)
    .is('gone_at', null);
  if (error) return { sent: 0, gone: 0, error: error.message };

  const rows = (data ?? []) as Row[];
  if (!rows.length) return { sent: 0, gone: 0 };

  const payload = JSON.stringify(note);
  let sent = 0;
  let gone = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        payload,
        { TTL: 60 * 60 * 6, urgency: note.silent ? 'low' : 'high' },
      );
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        gone += 1;
        await sb.from('push_subscriptions').update({ gone_at: new Date().toISOString() }).eq('id', r.id);
      } else {
        console.warn('[push] delivery failed', { status, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }));
  return { sent, gone };
}
