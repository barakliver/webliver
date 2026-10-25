'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Copy, Check, CreditCard, Landmark } from 'lucide-react';
import { chooseQuoteWay, type QuoteResult } from '@/app/actions/quotes';
import { bankLines } from '@/lib/quote';
import { TONE } from '@/lib/tone';
import type { QuoteCopy } from '@/content/ui';

function Say({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-ghost disabled:opacity-60">{label}</button>;
}

/**
 * The two ways to pay, side by side from `sm` up and stacked on a phone.
 *
 * The payment link is a plain anchor, so it works with nothing loaded and a
 * browser that blocks scripts still reaches the payment page; pressing it also
 * tells the producer which way was chosen, and a failure to tell does not stop
 * the visitor leaving. The bank transfer is the other way round: nothing here
 * can move money, so the button is a sentence the couple says to the producer,
 * "we transferred", and the screen words it as exactly that.
 *
 * Either answer can be changed until the producer marks it paid. The last one
 * stands, and the line under the cards says which it is.
 */
export function QuoteWays({ token, copy, payLink, bankText, choice }: {
  token: string; copy: QuoteCopy['page']; payLink: string | null; bankText: string; choice: string | null;
}) {
  const [bankState, bankAction] = useActionState<QuoteResult | null, FormData>(chooseQuoteWay, null);
  const [linkState, linkAction] = useActionState<QuoteResult | null, FormData>(chooseQuoteWay, null);
  const [copied, setCopied] = useState(false);
  const lines = bankLines(bankText);

  const said = bankState?.ok ? 'bank' : linkState?.ok ? 'link' : choice;

  const copyBank = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* The details are on screen and can be selected by hand. */
    }
  };

  if (!payLink && lines.length === 0) {
    return <p className="card mt-5 text-center text-body text-ink-soft">{copy.nothing}</p>;
  }

  return (
    <section className="mt-5" aria-labelledby="quote-pay">
      <h2 id="quote-pay" className="head-section text-center">{copy.payTitle}</h2>
      <p className="mt-1 text-center text-body text-ink-mute">{copy.payHint}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {payLink && (
          <div className="card flex min-w-0 flex-col">
            <span aria-hidden className={`grid size-10 place-items-center rounded-full ${TONE.rubine.fill}`}>
              <CreditCard size={18} strokeWidth={1.5} />
            </span>
            <h3 className="head-sub mt-3">{copy.viaLink}</h3>
            <p className="mt-1 flex-1 text-body leading-relaxed text-ink-soft">{copy.viaLinkBody}</p>
            <form action={linkAction} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="choice" value="link" />
              {/* Submitting records the choice; the anchor is what leaves. Both
                  happen on one press, the anchor first, so a slow answer from
                  the server never holds the visitor on this page. */}
              <a
                href={payLink} target="_blank" rel="noopener noreferrer"
                className="btn-primary inline-flex w-full items-center justify-center"
                onClick={(e) => { e.currentTarget.closest('form')?.requestSubmit(); }}
              >
                {copy.payNow}
              </a>
            </form>
            {linkState && !linkState.ok && <p role="alert" className="mt-2 text-body text-bad">{linkState.error}</p>}
          </div>
        )}

        {lines.length > 0 && (
          <div className="card flex min-w-0 flex-col">
            <span aria-hidden className={`grid size-10 place-items-center rounded-full ${TONE.boho.fill}`}>
              <Landmark size={18} strokeWidth={1.5} />
            </span>
            <h3 className="head-sub mt-3">{copy.viaBank}</h3>
            <p className="mt-1 text-body leading-relaxed text-ink-soft">{copy.viaBankBody}</p>
            <ul className={`mt-3 list-none space-y-1 rounded-card-sm p-3 text-body ${TONE.boho.wash}`}>
              {lines.map((l, i) => (
                <li key={i} dir="auto" style={{ unicodeBidi: 'plaintext' }} className="break-words">{l}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={copyBank} className="btn-quiet inline-flex items-center gap-1.5 text-body">
                {copied ? <Check size={14} strokeWidth={1.5} aria-hidden className="text-ok" /> : <Copy size={14} strokeWidth={1.5} aria-hidden />}
                {copied ? copy.copied : copy.copy}
              </button>
            </div>
            <form action={bankAction} className="mt-3">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="choice" value="bank" />
              <Say label={copy.transferred} />
            </form>
            {bankState && !bankState.ok && <p role="alert" className="mt-2 text-body text-bad">{bankState.error}</p>}
          </div>
        )}
      </div>

      {said && (
        <p role="status" className="mt-4 text-center text-body text-ok">
          {said === 'bank' ? copy.chosenBank : copy.chosenLink}
        </p>
      )}
    </section>
  );
}
