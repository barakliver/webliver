'use client';

import type { AuthCopy, PrivacyCopy, TermsCopy } from '@/content/ui';
import { GoogleButton } from './GoogleButton';

/**
 * One door, and it is Google's.
 *
 * This screen asked for an address and mailed a code, with Google as a faster
 * way in above it. Now there is only the button, for three reasons that are
 * the same reason: authorisation here is keyed on an email address, and a
 * Google sign-in is an address somebody has already proved they own, with no
 * inbox to wait on and no code to mistype in a venue. What the person is - a
 * producer, a couple, crew - is decided at the door by that address, so an
 * invitation still means "sign in with this address" and nothing more.
 *
 * The code step is gone from the screen and the actions behind it are still
 * there, closed by one constant (`CODE_SIGN_IN` in actions/auth.ts), so
 * unbolting it is one edit. The callback route still honours a link carrying
 * a token, so a mail already sent before this change keeps working.
 */
export function LoginForm({ next, prefill, reason, referral, copy, legal }: {
  next?: string;
  /** The wording, in the language the layout already resolved. This is a
   *  client component, so importing it here would ship both languages to
   *  every visitor and still render whichever one was compiled in. */
  copy: AuthCopy;
  /** The two documents the sentence under the button links to. */
  legal: { privacy: PrivacyCopy; terms: TermsCopy };
  /** The address a spent link already knew. Shown so the person signs in
   *  with the one that was invited, which is the one thing that matters. */
  prefill?: string;
  /** Why they were sent here rather than signed in. */
  reason?: string;
  /** A referral code off the address, carried through Google's round trip to
   *  the callback, which claims it once there is a session to attribute. */
  referral?: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-title font-light text-ink">{copy.title}</h1>
        <p className="mt-2 text-lead text-ink-soft">{copy.sub}</p>
      </div>

      {reason && (
        <p role="status" className="border-s-2 border-line-strong bg-transparent py-2 pe-3 text-body text-ink-soft">
          {reason === 'expired' ? copy.linkExpired : copy.linkMissing}
          {prefill && <b className="ms-1 text-ink" dir="ltr">{prefill}</b>}
        </p>
      )}

      <GoogleButton next={next ?? '/app'} copy={copy} referral={referral} />

      {/* What happens after the button, in three beats, because the next
          screen asks a question the person did not expect and a stranger
          who has been told is not a stranger who is surprised. The line
          between them draws itself once. */}
      <div>
        <ol className="flex list-none items-start justify-between gap-2 p-0">
          {copy.flow.map((step, i) => (
            <li key={step} className="animate-rise flex min-w-0 flex-1 flex-col items-center gap-2 text-center" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
              <span className={`grid size-7 place-items-center rounded-full text-meta ${i === 0 ? 'bg-tone-rubine text-tone-rubine-on' : 'border border-line-strong text-ink-soft'}`}>{i + 1}</span>
              <span className="text-meta leading-snug text-ink-soft">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-center text-meta text-ink-mute">{copy.flowInvited}</p>
      </div>

      <p className="text-body leading-relaxed text-ink-mute">{copy.note}</p>

      {/* Reachable from the screen where somebody is about to hand something
          over, which is the one place a policy is actually worth linking. */}
      <p className="text-body text-ink-mute">
        {copy.privacyNote}
        <a href="/terms" className="underline underline-offset-4 transition-colors hover:text-accent">
          {legal.terms.title}
        </a>
        {copy.legalJoin}
        <a href="/privacy" className="underline underline-offset-4 transition-colors hover:text-accent">
          {legal.privacy.title}
        </a>
      </p>
    </div>
  );
}
