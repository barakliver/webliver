/**
 * A ceiling on what the AI endpoints can cost, per lane.
 *
 * Every message is a paid API call. Without a limit the bill is set by
 * whoever is most determined, and the cheapest way to hurt this business
 * would be a loop in a browser console.
 *
 * **Two lanes, and this is the part that matters.** The concierge on the
 * public site and the copilot inside the console used to share one daily
 * budget, and the consequence was backwards: a producer spending the morning
 * drafting supplier emails would exhaust the ceiling, and a couple who then
 * arrived on the website asking about their wedding was told the assistant
 * was busy. Internal convenience starving the sales channel is the wrong way
 * round, so each lane now has its own budget and neither can spend the
 * other's.
 *
 * The per-caller ceiling differs too, and deliberately: an anonymous
 * stranger gets enough for a conversation, a signed-in producer gets enough
 * for a working session, because one of them is identified and accountable
 * and the other is a header.
 *
 * In memory, on purpose. This runs as one process on one machine, so a Map
 * is the honest implementation and a Redis dependency would be theatre. If it
 * ever runs on more than one instance the limit becomes per instance, which
 * is the moment to move it to the database — noted here so that day is not a
 * surprise.
 *
 * Why this is a plain module and `limit.ts` next to it is one line: the
 * `server-only` guard is resolved by Next's bundler and by nothing else, so a
 * test importing a module that carries it cannot even load. The routes import
 * the guarded file and keep the guard; the tests import this one and can
 * actually run. Same reason `fileTypes.ts` sits apart from its action.
 */

export type Lane = 'public' | 'producer';

const RULES: Record<Lane, { perCaller: number; windowMs: number; perDay: number }> = {
  /* A stranger, rate limited by an address that costs nothing to change. The
     daily figure is the one that actually bounds the invoice. */
  public:   { perCaller: 15, windowMs: 10 * 60_000, perDay: 400 },
  /* A signed-in, approved producer. Higher on both counts: they are drafting
     real work, and an account is a much better key than an address. */
  producer: { perCaller: 60, windowMs: 10 * 60_000, perDay: 600 },
};

type Bucket = { count: number; resetAt: number };

const callers = new Map<string, Bucket>();
const days: Record<Lane, Bucket> = {
  public:   { count: 0, resetAt: Date.now() + 86_400_000 },
  producer: { count: 0, resetAt: Date.now() + 86_400_000 },
};

/** Dropped on the way in, so a long-running process does not hold a row for
 *  every address that ever said hello. */
function sweep(now: number): void {
  if (callers.size < 500) return;
  for (const [key, b] of callers) if (b.resetAt <= now) callers.delete(key);
}

export type LimitVerdict = { ok: true } | { ok: false; reason: 'visitor' | 'day'; retryInSec: number };

export function checkLimit(callerKey: string, lane: Lane = 'public'): LimitVerdict {
  const now = Date.now();
  const rule = RULES[lane];
  sweep(now);

  const day = days[lane];
  if (day.resetAt <= now) { day.count = 0; day.resetAt = now + 86_400_000; }
  if (day.count >= rule.perDay) {
    return { ok: false, reason: 'day', retryInSec: Math.ceil((day.resetAt - now) / 1000) };
  }

  /* The lane is part of the key as well as of the rule, so a producer who is
     also browsing their own public site does not spend one bucket twice. */
  const key = `${lane}:${callerKey}`;
  const bucket = callers.get(key);
  if (!bucket || bucket.resetAt <= now) {
    callers.set(key, { count: 1, resetAt: now + rule.windowMs });
    day.count += 1;
    return { ok: true };
  }

  if (bucket.count >= rule.perCaller) {
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

/** Test seam. The buckets are module state by design; a test that could not
 *  clear them would be a test that depends on the order it runs in. */
export function resetLimits(): void {
  callers.clear();
  const now = Date.now();
  for (const lane of Object.keys(days) as Lane[]) {
    days[lane] = { count: 0, resetAt: now + 86_400_000 };
  }
}
