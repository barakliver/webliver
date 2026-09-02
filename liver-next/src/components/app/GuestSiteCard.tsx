'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { setGuestSite, type ActionResult } from '@/app/actions/clients';
import { appCopy } from '@/content/site';

const c = appCopy.guestSite;

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

/**
 * The switch for the guests' page, on the guests tab.
 *
 * The link exists before the switch is on, so it can be copied into a draft
 * invitation ahead of time; the page it opens simply says "not available"
 * until the producer turns it on. The address is built in the browser from
 * the page's own origin, the way the RSVP links are, so a tenant on their
 * own domain hands out their own domain.
 */
export function GuestSiteCard({ clientId, token, on, note }: {
  clientId: string; token: string | null; on: boolean; note: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setGuestSite, null);
  const [enabled, setEnabled] = useState(on);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (token) setUrl(`${window.location.origin}/w/${token}`);
  }, [token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* the field below is selectable; copying by hand still works */ }
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-light text-ink">
            <Globe size={18} aria-hidden strokeWidth={1.5} />
            {c.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        <span className={`rounded-xl2 px-3 py-1 text-[12.5px] ${enabled ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'}`}>
          {enabled ? c.on : c.off}
        </span>
      </div>

      <form action={action} className="mt-5" noValidate>
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="on" value={enabled ? '1' : '0'} />

        {token && (
          <div>
            <label className="label" htmlFor="guest-site-url">{c.link}</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="guest-site-url" readOnly value={url} dir="ltr"
                onFocus={(e) => e.currentTarget.select()}
                className="field min-w-[220px] flex-1 font-mono text-[13px]"
              />
              <button type="button" onClick={copy} className="btn-ghost">
                {copied ? <Check size={15} strokeWidth={1.5} aria-hidden /> : <Copy size={15} strokeWidth={1.5} aria-hidden />}
                {copied ? c.copied : c.copy}
              </button>
              <a href={url || '#'} target="_blank" rel="noopener noreferrer" className="btn-quiet">
                <ExternalLink size={15} strokeWidth={1.5} aria-hidden />
                {c.open}
              </a>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="label" htmlFor="guest-note">{c.note}</label>
          <textarea
            id="guest-note" name="note" rows={3} maxLength={1200}
            defaultValue={note} placeholder={c.notePh} className="field resize-y"
          />
          <p className="mt-1.5 text-[12.5px] text-ink-mute">{c.hint}</p>
        </div>

        {state && !state.ok && state.error && (
          <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {state.error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Save />
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className="btn-ghost"
          >
            {enabled ? c.turnOff : c.turnOn}
          </button>
          {state?.ok && <span className="text-[13.5px] text-ok">{c.saved}</span>}
        </div>
      </form>
    </section>
  );
}
