import 'server-only';
import { optional } from '@/lib/env';

type Mail = { to: string; subject: string; html: string; replyTo?: string };

/** Sends through Resend. Returns a result rather than throwing, because a
 *  failed notification must never lose the lead that triggered it. */
export async function sendMail(mail: Mail): Promise<{ sent: boolean; error?: string }> {
  const key = optional('RESEND_API_KEY');
  const from = optional('MAIL_FROM');
  if (!key || !from) return { sent: false, error: 'mail not configured' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [mail.to], subject: mail.subject, html: mail.html,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      signal: ctl.signal,
    });
    if (!res.ok) return { sent: false, error: `resend ${res.status}: ${(await res.text()).slice(0, 180)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}
