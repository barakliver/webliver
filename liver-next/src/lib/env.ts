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
export const publicEnv = {
  siteUrl:   process.env.NEXT_PUBLIC_SITE_URL   ?? 'https://liverproductions.com',
  whatsapp:  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '',
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
