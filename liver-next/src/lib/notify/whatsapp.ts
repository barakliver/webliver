import 'server-only';
import { optional } from '@/lib/env';

/** Posts to whatever webhook the producer configured. Kept deliberately generic
 *  so any provider that accepts a JSON POST works without a code change. */
export async function sendWhatsApp(text: string): Promise<{ sent: boolean; error?: string }> {
  const url = optional('WHATSAPP_WEBHOOK_URL');
  if (!url) return { sent: false, error: 'whatsapp webhook not configured' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: optional('WHATSAPP_ALERT_TO'), text }),
      signal: ctl.signal,
    });
    if (!res.ok) return { sent: false, error: `webhook ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}
