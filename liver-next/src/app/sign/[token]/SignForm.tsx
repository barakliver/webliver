'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { PenLine } from 'lucide-react';
import { signByLink, type SignResult } from '@/app/actions/sign';
import { signCopy as c } from '@/content/site';

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full justify-center gap-2 disabled:opacity-60">
      <PenLine size={16} strokeWidth={1.5} aria-hidden />
      {pending ? c.signing : c.sign}
    </button>
  );
}

/**
 * Typing a name, which is the signature.
 *
 * No canvas and no drawn squiggle, deliberately. A drawing on a phone screen
 * looks like a signature and proves nothing; what makes this one worth
 * anything is on the other side — the terms freeze on signature and the exact
 * text is fingerprinted, so a later edit is detectable rather than arguable.
 * A typed name plus that is stronger than a picture of a scrawl without it.
 *
 * The sentence above the button says what the button does while somebody can
 * still not press it.
 */
export function SignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, action] = useActionState<SignResult | null, FormData>(signByLink, null);

  return (
    <form action={action} className="card mt-5">
      <input type="hidden" name="token" value={token} />

      <label className="label" htmlFor="sign-name">{c.nameLabel}</label>
      <input
        id="sign-name"
        name="name"
        required
        minLength={2}
        maxLength={120}
        defaultValue={defaultName}
        autoComplete="name"
        placeholder={c.namePh}
        className="field"
      />

      <p className="mt-4 text-[13px] leading-relaxed text-ink-mute">{c.before}</p>

      <div className="mt-4">
        <Button />
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}
