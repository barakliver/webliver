import 'server-only';

/**
 * A ceiling on what a public AI endpoint can cost.
 *
 * Every message on this route is a paid API call made by an anonymous stranger.
 * Without a limit, the bill is set by whoever is most determined, and the
 * cheapest way to hurt this business would be a loop in a browser console.
 *
 * Two ceilings, because they stop different things. The per-visitor one stops
 * a single script; the daily one stops a hundred of them, and is the number
 * that actually bounds the invoice.
 *
 * In memory, on purpose. This runs as one process on one machine, so a Map is
 * the honest implementation and a Redis dependency would be theatre. If it
 * ever runs on more than one instance the limit becomes per instance, which is
 * the moment to move it to the database — noted here so that day is not a
 * surprise.
 */

const PER_VISITOR = 15;             // messages
const VISITOR_WINDOW_MS = 10 * 60_000;
const PER_DAY = 400;                // messages, everybody together

type Bucket = { count: number; resetAt: number };
const visitors = new Map<string, Bucket>();
let day: Bucket = { count: 0, resetAt: Date.now() + 86_400_000 };

/** Dropped on the way in, so a long-running process does not hold a row for
 *  every address that ever said hello. */
function sweep(now: number): void {
  if (visitors.size < 500) return;
  for (const [key, b] of visitors) if (b.resetAt <= now) visitors.delete(key);
}

export type LimitVerdict = { ok: true } | { ok: false; reason: 'visitor' | 'day'; retryInSec: number };

export function checkLimit(visitorKey: string): LimitVerdict {
  const now = Date.now();
  sweep(now);

  if (day.resetAt <= now) day = { count: 0, resetAt: now + 86_400_000 };
  if (day.count >= PER_DAY) {
    return { ok: false, reason: 'day', retryInSec: Math.ceil((day.resetAt - now) / 1000) };
  }

  const bucket = visitors.get(visitorKey);
  if (!bucket || bucket.resetAt <= now) {
    visitors.set(visitorKey, { count: 1, resetAt: now + VISITOR_WINDOW_MS });
    day.count += 1;
    return { ok: true };
  }

  if (bucket.count >= PER_VISITOR) {
    return { ok: false, reason: 'visitor', retryInSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  day.count += 1;
  return { ok: true };
}

/** Who is asking, as well as this can be known behind a proxy. Not an identity
 *  and not trusted for anything but rate limiting: a forged header costs an
 *  attacker a fresh bucket, which is the worst it can do here. */
export function visitorKeyFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
