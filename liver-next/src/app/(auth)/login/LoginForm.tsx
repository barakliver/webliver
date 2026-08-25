'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Mail, MessageSquare, RotateCw } from 'lucide-react';
import { CodeInput } from '@/components/app/CodeInput';
import { publicEnv } from '@/lib/env';
import { requestCode, verifyCode, type AuthResult, type Channel } from '@/app/actions/auth';
import { auth as copy } from '@/content/site';

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

export function LoginForm({ next, prefill, reason }: {
  next?: string;
  /** An address the callback already knows, so somebody arriving from a spent
   *  invitation link does not have to remember which of their addresses was
   *  invited. */
  prefill?: string;
  /** Why they were sent here rather than signed in. */
  reason?: string;
}) {
  /* Both steps live in one component so the address typed in step one is still
     on screen in step two: retyping it is the single most common way a code
     gets sent to one place and entered against another. */
  const [channel, setChannel] = useState<Channel>('email');
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
        onRestart={(c) => { setChannel(c); setSent(null); }}
        onResent={(r) => setSent(r)}
      />
    );
  }

  const phone = channel === 'phone';

  return (
    <form action={askAction} className="card space-y-5" noValidate>
      <div>
        <h1 className="font-display text-title font-light text-ink">{copy.title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{copy.sub}</p>
      </div>

      {askState && !askState.ok && askState.error && <Alert text={askState.error} />}

      {/* A link that has already been used, or that arrived truncated by a mail
          client. Said plainly and once: the address is already in the field
          below, so this is a sentence and a button rather than a dead end. */}
      {!askState && reason && (
        <p role="status" className="border-r-2 border-line-strong bg-transparent py-2 pe-3 text-[14.5px] text-ink-soft">
          {reason === 'expired' ? copy.linkExpired : copy.linkMissing}
        </p>
      )}

      {/* Two doors, named. A single field could sniff which one was meant, and
          does on the server, but a couple who were told "we texted you" need
          to see that texting is a thing this screen does before they type. */}
      {/* Underlined text rather than a pill in a box. A segmented control that
          fills the chosen half reads as two buttons where one is pressed; a
          gold rule under one word reads as a choice already made, which is
          what this is. The rule is the same mark the nav and the sidebar use. */}
      <div role="group" className="flex gap-6 border-b border-line">
        {(['email', 'phone'] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={channel === c}
            onClick={() => setChannel(c)}
            className={`relative -mb-px flex min-h-[44px] items-center gap-2 border-b px-1 text-[14.5px] tracking-[.03em] transition-colors duration-300 ${
              channel === c
                ? 'border-accent-line text-ink'
                : 'border-transparent text-ink-mute hover:text-ink'
            }`}
          >
            {c === 'email' ? <Mail size={16} aria-hidden strokeWidth={1.5} /> : <MessageSquare size={16} aria-hidden strokeWidth={1.5} />}
            {c === 'email' ? copy.byEmail : copy.byPhone}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="lg-contact">
          {phone ? copy.phoneLabel : copy.emailLabel}
        </label>
        <input
          /* Keyed on the channel so switching gives a genuinely empty field:
             a half typed address left behind in the phone box is the kind of
             thing that gets submitted without being looked at. */
          key={channel}
          id="lg-contact"
          name="contact"
          type={phone ? 'tel' : 'email'}
          inputMode={phone ? 'tel' : 'email'}
          autoComplete={phone ? 'tel' : 'email'}
          required
          dir="ltr"
          defaultValue={channel === 'email' ? prefill ?? '' : ''}
          className="field"
        />
        {phone && <p className="mt-1.5 text-[13px] text-ink-mute">{copy.phoneHint}</p>}
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
  sent, next, state, action, onRestart, onResent,
}: {
  sent: AuthResult;
  next?: string;
  state: AuthResult | null;
  action: (form: FormData) => void;
  onRestart: (channel: Channel) => void;
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
  const other: Channel = channel === 'email' ? 'phone' : 'email';

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

      <CodeInput key={at} name="code" label={copy.codeLabel} length={publicEnv.otpLength} />

      <p className={`text-center text-[13px] ${validLeft === 0 ? 'text-bad' : 'text-ink-mute'}`}>
        {validLeft > 0 ? copy.validFor(mmss(validLeft)) : copy.expired}
      </p>

      <Submit label={copy.codeSubmit} busy={copy.codeChecking} />

      <button
        type="button"
        onClick={resend}
        disabled={resending || resendLeft > 0}
        className="btn-quiet flex w-full items-center justify-center gap-2 disabled:opacity-55"
      >
        <RotateCw size={15} aria-hidden strokeWidth={1.5} className={resending ? 'animate-spin' : ''} />
        {resending ? copy.resendSending : resendLeft > 0 ? copy.resendIn(resendLeft) : copy.resend}
      </button>

      <div className="flex flex-col items-center gap-1.5 text-[13px]">
        <button
          type="button"
          onClick={() => onRestart(other)}
          className="text-ink-mute underline-offset-2 hover:text-ink hover:underline"
        >
          {other === 'email' ? copy.switchToEmail : copy.switchToPhone}
        </button>
        <button
          type="button"
          onClick={() => onRestart(channel)}
          className="text-ink-mute underline-offset-2 hover:text-ink hover:underline"
        >
          {channel === 'phone' ? copy.codeBackPhone : copy.codeBackEmail}
        </button>
      </div>
    </form>
  );
}
