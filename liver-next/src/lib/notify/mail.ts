import 'server-only';
import { optional } from '@/lib/env';

type Mail = { to: string; subject: string; html: string; replyTo?: string };
type Result = { sent: boolean; error?: string };

/**
 * Outgoing mail, through Resend.
 *
 * Two things it will not do. It will not throw: a failed notification must
 * never lose the lead or the invitation that triggered it, so every failure
 * comes back as a result and the caller decides. And it will not fail
 * silently: an unconfigured server used to return `{ sent: false }` with no
 * trace anywhere, which is indistinguishable from "sent successfully" to
 * anybody reading a log, and is how a fortnight of enquiry alerts went missing
 * without a single line to show for it.
 *
 * Important, because it has been misread: **this is not how sign-in codes are
 * sent.** Those come from Supabase Auth over whatever SMTP that project is
 * configured with, and no amount of configuration here changes them. Resend
 * can carry them, but only by being set as the project's custom SMTP server in
 * Supabase, which is a setting rather than code. What goes through this file is
 * the mail this app composes itself: lead alerts, workspace invitations,
 * confirmations.
 */

/** What is missing, in words somebody can act on. Empty when nothing is. */
function missing(): string[] {
  const gaps: string[] = [];
  if (!optional('RESEND_API_KEY')) gaps.push('RESEND_API_KEY');
  if (!optional('MAIL_FROM')) gaps.push('MAIL_FROM');
  return gaps;
}

/** True when this is a developer's machine rather than a server anybody
 *  depends on. Only there is it right to answer "sent" without sending. */
const isDev = process.env.NODE_ENV !== 'production';

export async function sendMail(mail: Mail): Promise<Result> {
  const gaps = missing();

  if (gaps.length > 0) {
    if (isDev) {
      /* Locally, print the letter instead of dropping it. Half the work of
         checking an email is reading it, and requiring an API key to see the
         wording of an invitation is a tax on every change to that wording. */
      console.info(
        [
          '',
          '─── mail (not sent: no ' + gaps.join(', ') + ') ───',
          `to:      ${mail.to}`,
          `subject: ${mail.subject}`,
          mail.replyTo ? `reply:   ${mail.replyTo}` : null,
          '',
          mail.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600),
          '────────────────────────────────────',
        ].filter(Boolean).join('\n')
      );
      return { sent: false, error: `mail not configured (${gaps.join(', ')})` };
    }

    /* On a real server this is a misconfiguration somebody has to fix, so it
       goes to the error log by name rather than being swallowed. */
    console.error('[mail] not configured; nothing was sent', { missing: gaps, to: mail.to });
    return { sent: false, error: `mail not configured (${gaps.join(', ')})` };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${optional('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: optional('MAIL_FROM'),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      signal: ctl.signal,
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      /* The two failures worth telling apart, because the fix is different and
         neither is obvious from a status code alone. */
      if (res.status === 401 || res.status === 403) {
        console.error('[mail] Resend refused the key', { status: res.status, to: mail.to, body });
        return { sent: false, error: 'the mail key was refused' };
      }
      if (res.status === 403 || /domain is not verified|only send testing emails/i.test(body)) {
        console.error('[mail] the sending domain is not verified', { to: mail.to, body });
        return { sent: false, error: 'the sending domain is not verified' };
      }
      console.error('[mail] Resend error', { status: res.status, to: mail.to, body });
      return { sent: false, error: `resend ${res.status}` };
    }

    return { sent: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'network error';
    /* An abort is a timeout, which is a different thing to report than a
       refused connection: one is slow, the other is unreachable. */
    const timedOut = e instanceof Error && e.name === 'AbortError';
    console.error('[mail] send failed', { to: mail.to, reason, timedOut });
    return { sent: false, error: timedOut ? 'the mail service timed out' : reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Whether outgoing mail is configured at all, for a screen that wants to say
 *  so before somebody presses a button and waits for a letter that will never
 *  arrive. */
export function mailIsConfigured(): boolean {
  return missing().length === 0;
}
