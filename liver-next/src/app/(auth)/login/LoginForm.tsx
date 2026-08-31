'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Mail, MessageSquare, RotateCw } from 'lucide-react';
import { CodeInput } from '@/components/app/CodeInput';
import { publicEnv } from '@/lib/env';
import { requestCode, verifyCode, type AuthResult, type Channel } from '@/app/actions/auth';
import type { AuthCopy, PrivacyCopy, TermsCopy } from '@/content/ui';
import { GoogleButton } from './GoogleButton';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="border-r-2 border-bad bg-transparent py-2 pe-3 text-[14.5px] text-bad">
      {text}
    </p>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p role="status" className="border-r-2 border-ok bg-transparent py-2 pe-3 text-[14.5px] text-ok">
      {text}
    </p>
  );
}

/** Seconds remaining from a fixed starting point, ticking once a second and
 *  stopping at zero. Counting from a timestamp rather than decrementing a
 *  number means a tab that was asleep for five minutes wakes up with the right
 *  answer instead of five minutes behind. */
function useCountdown(from: number, seconds: number): number {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil(seconds - (Date.now() - from) / 1000)));

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil(seconds - (Date.now() - from) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [from, seconds]);

  return left;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function LoginForm({ next, prefill, reason, referral, copy, legal }: {
  next?: string;
  /** The wording, in the language the layout already resolved. This is a
   *  client component, so importing it here would ship both languages to
   *  every visitor and still render whichever one was compiled in. */
  copy: AuthCopy;
  /** The two documents the sentence under the form links to. */
  legal: { privacy: PrivacyCopy; terms: TermsCopy };
  /** An address the callback already knows, so somebody arriving from a spent
   *  invitation link does not have to remember which of their addresses was
   *  invited. */
  prefill?: string;
  /** Why they were sent here rather than signed in. */
  reason?: string;
  /** A referral code off the address, carried through both steps so a producer
   *  who arrived on somebody's link is still attributed after the round trip
   *  to their inbox. Rides in a hidden field rather than in a cookie: it is
   *  one string, it is not a secret, and a cookie would outlive the signup it
   *  belongs to. */
  referral?: string;
}) {
  /* Both steps live in one component so the address typed in step one is still
     on screen in step two: retyping it is the single most common way a code
     gets sent to one place and entered against another. */
  /* Kept as a value rather than removed, so step two still posts the
     channel it verified against and the resend path stays one code path. */
  const channel: Channel = 'email';
  const [isNew, setIsNew] = useState(false);
  const [sent, setSent] = useState<AuthResult | null>(null);

  const [askState, askAction] = useActionState<AuthResult | null, FormData>(
    async (prev, form) => {
      form.set('channel', channel);
      const r = await requestCode(prev, form);
      if (r.ok && r.contact) setSent(r);
      return r;
    },
    null
  );
  const [checkState, checkAction] = useActionState<AuthResult | null, FormData>(verifyCode, null);

  if (sent?.contact) {
    return (
      <CodeStep
        sent={sent}
        next={next}
        state={checkState}
        action={checkAction}
        referral={referral}
        copy={copy}
        onRestart={() => setSent(null)}
        onResent={(r) => setSent(r)}
      />
    );
  }

  return (
    <form action={askAction} className="card space-y-5" noValidate>
      <div>
        <h1 className="font-display text-title font-light text-ink">{copy.title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{copy.sub}</p>
      </div>

      {/* Above the fields, because for most people this is the whole screen.
          What is under it is not a fallback for a broken feature, it is the
          way in for somebody without a Google account on their phone — which
          is a real person, usually a parent, and usually the one who needs it
          to work. */}
      <GoogleButton next={next ?? '/app'} copy={copy} />

      {askState && !askState.ok && askState.error && <Alert text={askState.error} />}

      {/* A link that has already been used, or that arrived truncated by a mail
          client. Said plainly and once: the address is already in the field
          below, so this is a sentence and a button rather than a dead end. */}
      {!askState && reason && (
        <p role="status" className="border-r-2 border-line-strong bg-transparent py-2 pe-3 text-[14.5px] text-ink-soft">
          {reason === 'expired' ? copy.linkExpired : copy.linkMissing}
        </p>
      )}

      {/* One door now. The phone tab is gone rather than disabled: a control
          that cannot be pressed is a question the screen is still asking.
          Authorisation here is keyed on an email address — an event names up
          to three of them — so a person arriving any other way is signed in
          and belongs to nothing. */}

      <div>
        <label className="label" htmlFor="lg-contact">{copy.emailLabel}</label>
        <input
          id="lg-contact"
          name="contact"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          dir="ltr"
          defaultValue={prefill ?? ''}
          className="field"
        />
      </div>

      {/* The whole row is the target, not the 16px box. A checkbox is the
          smallest thing on any form and the one most often missed by a
          thumb. */}
      <label className="flex min-h-[44px] items-center gap-2.5 text-[14.5px] text-ink-soft">
        <input
          type="checkbox"
          className="size-5 rounded border-line-strong accent-accent"
          checked={isNew}
          onChange={(e) => setIsNew(e.target.checked)}
        />
        {copy.newHere}
      </label>

      {isNew && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="lg-name">{copy.nameLabel}</label>
            <input id="lg-name" name="full_name" autoComplete="name" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="lg-brand">{copy.brandLabel}</label>
            <input id="lg-brand" name="brand_name" className="field" />
          </div>
        </div>
      )}

      <Submit label={copy.submit} busy={copy.sending} />

      <p className="text-[13px] leading-relaxed text-ink-mute">{copy.note}</p>

      {/* Reachable from the screen where somebody is about to hand something
          over, which is the one place a policy is actually worth linking. */}
      <p className="text-[13px] text-ink-mute">
        {copy.privacyNote}
        <a href="/terms" className="underline underline-offset-4 transition-colors hover:text-accent">
          {legal.terms.title}
        </a>
        {copy.legalJoin}
        <a href="/privacy" className="underline underline-offset-4 transition-colors hover:text-accent">
          {legal.privacy.title}
        </a>
      </p>
    </form>
  );
}

/** Step two, with the two things it was missing: a way to see that the code is
 *  running out, and a way to get another one.
 *
 *  Neither countdown is a rule. The server decides whether a code is still
 *  good; these only make the decision somebody has to take next obvious. When
 *  the validity timer reaches zero the field stays enabled, because the number
 *  in this file is a guess at a project setting and the code may well still
 *  work. */
function CodeStep({
  sent, next, state, action, onRestart, onResent, referral, copy,
}: {
  sent: AuthResult;
  next?: string;
  copy: AuthCopy;
  state: AuthResult | null;
  action: (form: FormData) => void;
  onRestart: () => void;
  referral?: string;
  onResent: (result: AuthResult) => void;
}) {
  const channel: Channel = sent.channel ?? 'email';
  const at = sent.sentAt ?? Date.now();

  const validLeft = useCountdown(at, publicEnv.otpTtl);
  const resendLeft = useCountdown(at, publicEnv.otpResendAfter);

  const [resending, startResend] = useTransition();
  const [resent, setResent] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const resend = () => {
    setResent(null);
    setResendError(null);
    startResend(async () => {
      const form = new FormData();
      form.set('channel', channel);
      form.set('contact', sent.contact ?? '');
      const r = await requestCode(null, form);
      if (r.ok && r.contact) {
        onResent(r);
        setResent(channel === 'phone' ? copy.resentPhone : copy.resentEmail);
      } else {
        setResendError(r.error ?? copy.expired);
      }
    });
  };

  /* An error belongs to the code it was raised about. Once a new one has been
     sent, "the code is not right" is a statement about a code nobody is
     holding any more, and leaving it on screen next to a fresh code is how
     somebody concludes the new one failed before they had typed it. The
     timestamp travels through the form and comes back, so the two can be
     told apart without any extra bookkeeping. */
  const failed = state && !state.ok && state.error && state.sentAt === at;

  return (
    <form action={action} className="card space-y-5" noValidate>
      <div>
        <h1 className="font-display text-title font-light text-ink">{copy.codeTitle}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          {channel === 'phone' ? copy.codeSentPhone : copy.codeSentEmail}{' '}
          <b className="text-ink" dir="ltr">{sent.display ?? sent.contact}</b>
        </p>
      </div>

      {failed && <Alert text={state!.error!} />}
      {resendError && <Alert text={resendError} />}
      {resent && !failed && <Note text={resent} />}

      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="contact" value={sent.contact ?? ''} />
      <input type="hidden" name="display" value={sent.display ?? ''} />
      <input type="hidden" name="sent_at" value={String(at)} />
      {next && <input type="hidden" name="next" value={next} />}
      {referral && <input type="hidden" name="ref" value={referral} />}

      <CodeInput key={at} name="code" label={copy.codeLabel} length={publicEnv.otpLength} />

      <p className={`text-center text-[13px] ${validLeft === 0 ? 'text-bad' : 'text-ink-mute'}`}>
        {validLeft > 0 ? copy.validFor.replace('{t}', mmss(validLeft)) : copy.expired}
      </p>

      <Submit label={copy.codeSubmit} busy={copy.codeChecking} />

      <button
        type="button"
        onClick={resend}
        disabled={resending || resendLeft > 0}
        className="btn-quiet flex w-full items-center justify-center gap-2 disabled:opacity-55"
      >
        <RotateCw size={15} aria-hidden strokeWidth={1.5} className={resending ? 'animate-spin' : ''} />
        {resending ? copy.resendSending : resendLeft > 0 ? copy.resendIn.replace('{s}', String(resendLeft)) : copy.resend}
      </button>

      <div className="flex flex-col items-center gap-1.5 text-[13px]">
        {/* One link where there were two. With a single door there is nothing
            to switch to, and offering it would send somebody back to a screen
            that looks identical to the one they left. */}
        <button
          type="button"
          onClick={() => onRestart()}
          className="text-ink-mute underline-offset-2 hover:text-ink hover:underline"
        >
          {channel === 'phone' ? copy.codeBackPhone : copy.codeBackEmail}
        </button>
      </div>
    </form>
  );
}
