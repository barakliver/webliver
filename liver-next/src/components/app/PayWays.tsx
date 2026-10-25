'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';
import { savePayWays, type QuoteResult } from '@/app/actions/quotes';
import type { QuoteCopy } from '@/content/ui';

function Save({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? busy : idle}</button>;
}

/**
 * Where the producer is paid, written once.
 *
 * Two fields and nothing clever. The link is whatever payment page their
 * clearing service gave them; the bank block is free text because an account
 * is written differently in every bank and a producer who wants a line saying
 * "ask us for the standing order form" should be able to type it. A quote
 * copies both when it is sent, and the last line says so.
 */
export function PayWays({ copy, paymentLink, bankDetails }: {
  copy: QuoteCopy['settings']; paymentLink: string; bankDetails: string;
}) {
  const [state, action] = useActionState<QuoteResult | null, FormData>(savePayWays, null);
  return (
    <section id="pay" className="card mt-5 scroll-mt-24 space-y-4" aria-labelledby="pay-title">
      <div>
        <h2 id="pay-title" className="head-sub">{copy.title}</h2>
        <p className="mt-1 text-body text-ink-soft">{copy.intro}</p>
      </div>
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="payment_link">{copy.link}</label>
          <input id="payment_link" name="payment_link" className="field" dir="ltr" inputMode="url"
            defaultValue={paymentLink} maxLength={500} autoComplete="off" />
          <p className="mt-1 text-meta text-ink-mute">{copy.linkHint}</p>
        </div>
        <div>
          <label className="label" htmlFor="bank_details">{copy.bank}</label>
          <textarea id="bank_details" name="bank_details" rows={4} className="field"
            defaultValue={bankDetails} maxLength={1200} placeholder={copy.bankPh} />
          <p className="mt-1 text-meta text-ink-mute">{copy.bankHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Save idle={copy.save} busy={copy.saving} />
          {state?.ok && <span role="status" className="inline-flex items-center gap-1 text-body text-ok"><Check size={15} aria-hidden />{copy.saved}</span>}
          {state && !state.ok && <span role="alert" className="text-body text-bad">{state.error}</span>}
        </div>
        <p className="text-meta text-ink-mute">{copy.snapshot}</p>
      </form>
    </section>
  );
}
