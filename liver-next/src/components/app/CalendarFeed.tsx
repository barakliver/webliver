'use client';

import { useState, useTransition } from 'react';
import { CalendarPlus, Copy, Check, Trash2 } from 'lucide-react';
import { appCopy } from '@/content/site';
import { feedLink, revokeFeed } from '@/app/actions/calendarFeed';

const c = appCopy.calendar.feed;

/**
 * A subscription, rather than a download.
 *
 * The .ics file next to this is a snapshot: it is correct on the day it is
 * saved and wrong the first time an event moves. A subscription is the thing
 * people actually mean when they say "put it in my calendar", and the only way
 * to serve one is a secret in the URL, since calendar apps fetch on their own
 * schedule with no session.
 *
 * Which makes the address a credential, so the screen says so in plain words
 * and keeps a way to turn it off in reach. A revoke button hidden behind a
 * settings screen is one nobody finds on the day they need it.
 */
export function CalendarFeed({ clientId }: { clientId?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();

  const url = token ? `${typeof window === 'undefined' ? '' : window.location.origin}/feed/${token}.ics` : '';
  const webcal = url.replace(/^https?:/, 'webcal:');

  const create = () => start(async () => {
    setError(null);
    setGone(false);
    const r = await feedLink(clientId);
    if (r.ok && r.token) setToken(r.token);
    else setError(r.error ?? 'לא הצלחנו ליצור קישור');
  });

  const drop = () => start(async () => {
    const r = await revokeFeed(clientId);
    if (r.ok) { setToken(null); setGone(true); }
    else setError(r.error ?? 'לא הצלחנו לבטל');
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* A browser that refuses the clipboard is not a failure worth a message:
         the address is on screen and selectable. */
    }
  };

  return (
    <div className="card">
      <h2 className="font-display text-[17px] font-light text-ink">{c.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.sub}</p>

      {!token ? (
        <>
          <button type="button" onClick={create} disabled={pending} className="btn-ghost mt-3 text-[14px]">
            <CalendarPlus size={16} aria-hidden strokeWidth={1.5} />
            {pending ? c.creating : c.create}
          </button>
          {gone && <p className="mt-2 text-[13.5px] text-ok">{c.revoked}</p>}
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="rounded-none bg-warn-wash p-3 text-[13.5px] text-warn">{c.warning}</p>

          <code className="block overflow-x-auto rounded-none bg-surface-100 p-3 text-[12.5px] text-ink-soft" dir="ltr">
            {url}
          </code>

          <div className="flex flex-wrap gap-2">
            <a href={webcal} className="btn-primary text-[14px]">{c.open}</a>
            <button type="button" onClick={copy} className="btn-ghost text-[14px]">
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? c.copied : c.copy}
            </button>
            <button type="button" onClick={drop} disabled={pending} className="btn-ghost text-[14px] text-bad">
              <Trash2 size={16} aria-hidden /> {c.revoke}
            </button>
          </div>

          <p className="text-[13px] text-ink-mute">{c.how}</p>
        </div>
      )}

      {error && <p className="mt-2 text-[13.5px] text-bad">{error}</p>}
    </div>
  );
}
