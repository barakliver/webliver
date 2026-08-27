'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Link2, Copy, Check, MessageCircle, Ban } from 'lucide-react';
import { issueSignLink, revokeSignLink, type ContractResult } from '@/app/actions/contracts';
import { linkCopy as c } from '@/content/site';

function Make() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-ghost inline-flex items-center gap-1.5 text-[13.5px] disabled:opacity-60">
      <Link2 size={15} strokeWidth={1.5} aria-hidden />
      {pending ? c.making : c.make}
    </button>
  );
}

/**
 * A link a supplier signs from.
 *
 * The link is shown once, here, and is not stored anywhere in the browser. A
 * producer copies it into WhatsApp and it is gone from this screen on the next
 * render, which is the right shape for a credential: it exists in the message
 * that was sent and in the database, and nowhere in between.
 *
 * Copy first and WhatsApp second, in that order. On a laptop the copy button
 * is the one that works.
 */
export function SignLink({ contractId, clientId, party }: {
  contractId: string; clientId: string; party: string;
}) {
  const [state, action] = useActionState<ContractResult | null, FormData>(issueSignLink, null);
  const [copied, setCopied] = useState(false);
  const url = state?.ok ? state.id : undefined;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* A browser that refuses the clipboard still shows the link in the box
         below, where it can be selected by hand. */
    }
  };

  const wa = url
    ? `https://wa.me/?text=${encodeURIComponent(`${party ? party + ', ' : ''}מצורף ההסכם לחתימה:\n${url}`)}`
    : '#';

  return (
    <>
      <form action={action}>
        <input type="hidden" name="contract_id" value={contractId} />
        <input type="hidden" name="client_id" value={clientId} />
        <Make />
      </form>

      {state && !state.ok && (
        <p role="alert" className="basis-full text-[13px] text-bad">{c.failed}</p>
      )}

      {url && (
        <div className="basis-full">
          <p className="text-[13px] text-ok">{c.ready}</p>

          {/* Readable and selectable, not hidden behind a button. A link
              somebody cannot see is a link they cannot check before sending. */}
          <p
            dir="ltr"
            className="mt-2 overflow-x-auto rounded-xl2 border border-line bg-surface-100 px-3 py-2
                       text-start font-mono text-[12px] text-ink-soft"
          >
            {url}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="btn-ghost inline-flex items-center gap-1.5 text-[13px]">
              {copied
                ? <Check size={14} strokeWidth={1.5} aria-hidden className="text-ok" />
                : <Copy size={14} strokeWidth={1.5} aria-hidden />}
              {copied ? c.copied : c.copy}
            </button>

            <a href={wa} target="_blank" rel="noopener noreferrer"
               className="btn-ghost inline-flex items-center gap-1.5 text-[13px]">
              <MessageCircle size={14} strokeWidth={1.5} aria-hidden />
              {c.whatsapp}
            </a>

            <form action={revokeSignLink}>
              <input type="hidden" name="contract_id" value={contractId} />
              <input type="hidden" name="client_id" value={clientId} />
              <button type="submit" className="btn-quiet inline-flex items-center gap-1.5 text-[13px]">
                <Ban size={14} strokeWidth={1.5} aria-hidden />
                {c.revoke}
              </button>
            </form>
          </div>

          <p className="mt-2 text-[12.5px] text-ink-mute">{c.revokeNote}</p>
        </div>
      )}
    </>
  );
}
