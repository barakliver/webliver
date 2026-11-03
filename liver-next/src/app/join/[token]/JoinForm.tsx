'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { leaveDetails, joinWithAccount, type JoinResult } from '@/app/actions/join';
import { GoogleButton } from '@/app/(auth)/login/GoogleButton';
import type { AuthCopy, JoinCopy } from '@/content/ui';

function Send({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary min-h-[48px] w-full disabled:opacity-60">
      {pending ? busy : idle}
    </button>
  );
}

/**
 * Name, phone, address and two ticks.
 *
 * One form for both doors. Signed in with Google the address is the account's
 * and is shown, not asked; signed out it is asked, the details are saved, and
 * the page then offers Google as the way to get in. The two ticks are two
 * ticks: the terms are required to come in, and the list is a favour that
 * starts unticked and says so.
 *
 * The field called `website` is for bots. It is off the screen and out of the
 * tab order, and a form that arrives with it filled in was not filled in by a
 * person.
 */
export function JoinForm({ token, copy, auth, mode, defaultName = '', fixedEmail = '' }: {
  token: string; copy: JoinCopy; auth: AuthCopy; mode: 'details' | 'account';
  defaultName?: string; fixedEmail?: string;
}) {
  const [state, action] = useActionState<JoinResult | null, FormData>(
    mode === 'account' ? joinWithAccount : leaveDetails, null,
  );
  const bad = new Set(state?.fields ?? []);

  if (mode === 'details' && state?.ok) {
    return (
      <div className="card text-center" role="status">
        <div aria-hidden className="pop-in mx-auto mb-3 grid size-14 place-items-center rounded-full bg-tone-rubine text-tone-rubine-on">
          <Check size={26} strokeWidth={2} />
        </div>
        <h2 className="head-section">{copy.thanksTitle}</h2>
        <p className="mt-2 text-body text-ink-soft">{copy.thanksBody}</p>
        <p className="mt-5 text-body text-ink">{copy.thanksCta}</p>
        <div className="mx-auto mt-3 max-w-sm">
          <GoogleButton copy={auth} next={`/join/${token}`} />
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label className="label" htmlFor="join-name">{copy.name}</label>
        <input id="join-name" name="name" className="field" defaultValue={defaultName} autoComplete="name"
          required aria-invalid={bad.has('name') || undefined} maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="join-phone">{copy.phone}</label>
        <input id="join-phone" name="phone" type="tel" dir="ltr" inputMode="tel" className="field"
          autoComplete="tel" required aria-invalid={bad.has('phone') || undefined} maxLength={30} />
      </div>
      <div>
        <label className="label" htmlFor="join-email">{copy.email}</label>
        {mode === 'account' ? (
          <>
            <p id="join-email" dir="ltr" className="field flex items-center bg-surface-100 text-start text-ink-soft">{fixedEmail}</p>
            <p className="mt-1 text-meta text-ink-mute">{copy.emailFixed}</p>
          </>
        ) : (
          <input id="join-email" name="email" type="email" dir="ltr" inputMode="email" className="field"
            autoComplete="email" required aria-invalid={bad.has('email') || undefined} maxLength={200} />
        )}
      </div>

      <label className="flex items-start gap-3 text-body text-ink">
        <input type="checkbox" name="terms" className="mt-1 size-5 shrink-0" required
          aria-invalid={bad.has('terms') || undefined} />
        <span>
          {copy.termsLead}{' '}
          <Link href="/terms" target="_blank" className="underline underline-offset-4">{copy.termsLink}</Link>
          {' '}{copy.termsAnd}{' '}
          <Link href="/privacy" target="_blank" className="underline underline-offset-4">{copy.privacyLink}</Link>
        </span>
      </label>

      <label className="flex items-start gap-3 text-body text-ink">
        <input type="checkbox" name="list" className="mt-1 size-5 shrink-0" />
        <span>
          {copy.list}
          <span className="mt-0.5 block text-meta text-ink-mute">{copy.listHint}</span>
        </span>
      </label>

      <Send idle={mode === 'account' ? copy.enter : copy.submit} busy={copy.sending} />
      {state && !state.ok && <p role="alert" className="text-body text-bad">{state.error}</p>}
    </form>
  );
}
