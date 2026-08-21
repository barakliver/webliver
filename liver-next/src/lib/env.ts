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
};
