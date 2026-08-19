'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestCode, verifyCode, type AuthResult } from '@/app/actions/auth';
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
    <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14.5px] text-rose-800">
      {text}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  /* Kept in one component so the address typed in step one is still on screen
     in step two: retyping it is the single most common way a code gets sent
     to one address and entered against another. */
  const [sent, setSent] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [askState, askAction] = useActionState<AuthResult | null, FormData>(
    async (prev, form) => {
      const r = await requestCode(prev, form);
      if (r.ok && r.email) setSent(r.email);
      return r;
    },
    null
  );
  const [checkState, checkAction] = useActionState<AuthResult | null, FormData>(verifyCode, null);

  if (sent) {
    return (
      <form action={checkAction} className="card space-y-5" noValidate>
        <div>
          <h1 className="font-display text-title font-semibold text-ink">{copy.codeTitle}</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            {copy.codeSent} <b className="text-ink">{sent}</b>
          </p>
        </div>

        {checkState && !checkState.ok && checkState.error && <Alert text={checkState.error} />}

        <input type="hidden" name="email" value={sent} />
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label className="label" htmlFor="lg-code">{copy.codeLabel}</label>
          <input
            id="lg-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            required
            dir="ltr"
            className="field text-center text-[22px] tracking-[0.5em]"
          />
        </div>

        <Submit label={copy.codeSubmit} busy={copy.codeChecking} />

        <button type="button" onClick={() => setSent(null)} className="btn-quiet w-full">
          {copy.codeBack}
        </button>
      </form>
    );
  }

  return (
    <form action={askAction} className="card space-y-5" noValidate>
      <div>
        <h1 className="font-display text-title font-semibold text-ink">{copy.title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{copy.sub}</p>
      </div>

      {askState && !askState.ok && askState.error && <Alert text={askState.error} />}

      <div>
        <label className="label" htmlFor="lg-email">{copy.emailLabel}</label>
        <input id="lg-email" name="email" type="email" required autoComplete="email" dir="ltr" className="field" />
      </div>

      <label className="flex items-center gap-2.5 text-[14.5px] text-ink-soft">
        <input type="checkbox" className="h-4 w-4 rounded border-line-strong" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
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
