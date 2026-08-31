/** The platform's own hostname, in one place.
 *
 *  It was written out as a literal in eleven files. They all agreed, and they
 *  were all correct; the constant survives anyway, because eleven copies of a
 *  hostname is eleven places to be wrong the day it changes.
 */
export const PLATFORM_HOST = 'liverproductions.com';

/** Reads an environment variable, failing loudly at the call site rather than
 *  silently rendering a broken page. */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}
export function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}
/**
 * Where this deployment actually lives.
 *
 * `NEXT_PUBLIC_SITE_URL` is right almost everywhere and catastrophic in one
 * case: a production server still carrying the value a laptop needed. Every
 * link this app *mails* is built from it — the invitation, the sign-in, the
 * signing link for a supplier — so one stale variable does not break a page
 * anybody can see, it silently posts `http://localhost:3000` to a couple who
 * then get a connection refused. Which is exactly what happened.
 *
 * A local address is honoured in development, where it is the whole point,
 * and refused outside it in favour of the real host. Loudly, because the
 * variable still needs fixing and a silent correction is how it stays wrong.
 */
function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const real = `https://${PLATFORM_HOST}`;
  if (!raw) return real;

  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(raw);
  if (local && process.env.NODE_ENV === 'production') {
    console.error(
      '[env] NEXT_PUBLIC_SITE_URL is a local address on a production build, so '
      + 'every mailed link would point at the recipient\'s own machine. Using '
      + `${real} instead. Fix the variable in .env.local and rebuild.`,
      { value: raw },
    );
    return real;
  }
  return raw;
}

export const publicEnv = {
  siteUrl:   resolveSiteUrl(),
  /* His number, in the international form wa.me needs.
     It has a real default for the same reason the booking link does: it is a
     property of the business rather than of a deployment, and the empty
     string it used to fall back to turned the WhatsApp button into nothing
     while the example file quietly shipped 972500000000 to anybody who
     copied it. A placeholder number is worse than none. The variable still
     wins, for a second producer or a changed line. */
  whatsapp:  (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '972526604320').replace(/\D/g, ''),
  /* Where an accessibility problem is reported. A statement that names no
     way to reach anybody does not meet the requirement it is written for. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'barakliver@gmail.com',
  /* The booking page is a fixed property of the business, not of a
     deployment, so it has a real default rather than an empty string that
     silently turns the "book a meeting" button into a contact form. The
     environment variable still wins, for a staging site or a changed link. */
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || 'https://calendar.app.google/oZ6HtbigyFaxxDGc8',
  /* How many digits the sign-in code has.
     This is a Supabase project setting, not something this code decides, and
     the two have to agree: a screen showing six boxes for an eight digit code
     cannot be filled in at all, and the person typing gets blamed for it. Six
     is the intended value and the default; the variable exists so a project
     configured differently can be matched without a deploy. */
  /* A file in /public, or a URL. Empty means the hero is the photograph, which
     is what it is today: there is no footage yet, and a hero that waits for a
     file nobody has shot is a hero that is broken until then. */
  heroVideo: process.env.NEXT_PUBLIC_HERO_VIDEO ?? '',
  otpLength: Math.min(12, Math.max(4, Number(process.env.NEXT_PUBLIC_OTP_LENGTH) || 6)),
  /* How long a code stays good for, in seconds, and how long before another
     one may be asked for. Both are Supabase project settings and neither is
     enforced here — the countdown on screen is a courtesy, not a gate. When it
     reaches zero the code is not refused; the button to send a new one simply
     becomes the obvious thing to press. That distinction matters: the length
     of the code taught us what happens when a number in this file is allowed
     to overrule the server. */
  otpTtl: Math.min(3600, Math.max(60, Number(process.env.NEXT_PUBLIC_OTP_TTL_SECONDS) || 900)),
  otpResendAfter: Math.min(300, Math.max(15, Number(process.env.NEXT_PUBLIC_OTP_RESEND_SECONDS) || 60)),
};
