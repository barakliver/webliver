'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Copy, ExternalLink, MessageCircle, Spade } from 'lucide-react';
import { setWeddingGame, type ActionResult } from '@/app/actions/clients';
import { gameAdmin as c } from '@/content/game';

function Save({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.saving : on ? c.turnOff : c.turnOn}
    </button>
  );
}

/**
 * The card game's switch, on the event file.
 *
 * Drawn only for the root account — the page it sits on decides that — and
 * refused again by the action and a third time by the trigger in 0096. Three
 * lines for one switch is not belt and braces for its own sake: the first two
 * are so the wrong person gets a screen that makes sense, and the third is the
 * one that would still hold if somebody wrote to the table from a script.
 *
 * The link exists before the switch is on, the same way the guests' page link
 * does, so it can be pasted into a message being written now for a couple
 * whose game opens later. Until it is switched on the address answers nobody.
 */
export function GameSwitch({ clientId, token, on }: {
  clientId: string; token: string | null; on: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setWeddingGame, null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  /* Built from the page's own origin rather than from an environment
     variable, the way every other shared link in this product is: a tenant on
     their own domain has to hand out their own domain. */
  useEffect(() => {
    if (token) setUrl(`${window.location.origin}/play/${token}`);
  }, [token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* the field is selectable; copying by hand still works */ }
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-semibold text-ink">
            <Spade size={18} aria-hidden strokeWidth={1.5} />
            {c.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        <span className={`rounded-xl2 px-3 py-1 text-[12.5px] ${on ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'}`}>
          {on ? c.on : c.off}
        </span>
      </div>

      <form action={action} className="mt-5" noValidate>
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="on" value={on ? '0' : '1'} />

        {token && (
          <div>
            <label className="label" htmlFor="game-url">{c.link}</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="game-url" readOnly value={url} dir="ltr"
                onFocus={(e) => e.currentTarget.select()}
                className="field min-w-[220px] flex-1 font-mono text-[13px]"
              />
              <button type="button" onClick={copy} className="btn-ghost">
                {copied ? <Check size={15} strokeWidth={1.5} aria-hidden /> : <Copy size={15} strokeWidth={1.5} aria-hidden />}
                {copied ? c.copied : c.copy}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${c.shareText}\n${url}`)}`}
                target="_blank" rel="noopener noreferrer" className="btn-ghost"
              >
                <MessageCircle size={15} strokeWidth={1.5} aria-hidden />
                {c.share}
              </a>
              <a href={url || '#'} target="_blank" rel="noopener noreferrer" className="btn-quiet">
                <ExternalLink size={15} strokeWidth={1.5} aria-hidden />
                {c.open}
              </a>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-mute">{c.hint}</p>
          </div>
        )}

        {state && !state.ok && state.error && (
          <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {state.error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Save on={on} />
          {state?.ok && <span className="text-[13.5px] text-ok">{c.saved}</span>}
        </div>
      </form>
    </section>
  );
}
