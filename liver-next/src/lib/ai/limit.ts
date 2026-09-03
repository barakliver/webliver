import 'server-only';

/**
 * The rate limiter, as the routes see it.
 *
 * One line of re-export, and the `server-only` guard is the whole point of
 * it: this module state means nothing in a browser, and a bundle that pulled
 * it in would be silently rate limiting nobody. The implementation is next
 * door in `budget.ts` without the guard, because `server-only` resolves
 * through Next's bundler alone and a test importing it cannot load at all.
 * Both files are one module instance, so the buckets are shared.
 */
export { checkLimit, visitorKeyFrom, resetLimits } from './budget';
export type { Lane, LimitVerdict } from './budget';
