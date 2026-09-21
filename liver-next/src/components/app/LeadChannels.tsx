'use client';

import { useActionState, useRef, useState } from 'react';
import { BadgeCheck, Check, Copy, Link2, Plus, RefreshCw, Trash2, TriangleAlert, X } from 'lucide-react';
import {
  addChannel, renameChannel, setChannelEnabled, rotateChannel, removeChannel, testChannel,
  type ChannelResult,
} from '@/app/actions/leadChannels';
import { CHANNEL_KINDS, channelUrl, type LeadChannel } from '@/content/channels';
import { useCopy } from '@/components/app/CopyProvider';
import { cn } from '@/lib/utils';
import { EVENT_ZONE } from '@/lib/clock';
import type { Locale } from '@/lib/locale';
import { DeleteForm } from '@/components/app/ConfirmDelete';

/**
 * Where a producer connects the places their enquiries actually come from.
 *
 * The screen has one job and it is not configuration: it is handing somebody a
 * URL they are about to paste into Meta's console in another tab. So the
 * address is the largest thing on each row, the copy button is next to it, and
 * everything else — what it is, whether it is live, how many it has brought in
 * — is small print around that one line.
 *
 * The address is shown in full rather than masked. A producer pasting into an
 * ad console needs to see that what landed there is what they copied, and a
 * secret they are not allowed to read is a secret they will screenshot.
 */
export function LeadChannels({ channels, origin }: {
  channels: LeadChannel[];
  /** The platform's own origin, resolved on the server. Building it from
   *  `window.location` would hand a producer on their own white-label domain
   *  a URL under that domain, which works today and breaks the morning their
   *  domain moves. */
  origin: string;
}) {
  const c = useCopy().channel;
  const [adding, setAdding] = useState(false);

  const [state, action, pending] = useActionState<ChannelResult | null, FormData>(
    async (prev, form) => {
      const r = await addChannel(prev, form);
      if (r.ok) setAdding(false);
      return r;
    },
    null,
  );

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <Link2 size={17} strokeWidth={1.5} aria-hidden />
            {c.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        <button
          type="button" onClick={() => setAdding((v) => !v)}
          className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]"
        >
          {adding ? <X size={14} strokeWidth={1.5} aria-hidden /> : <Plus size={14} strokeWidth={1.5} aria-hidden />}
          {c.add}
        </button>
      </div>

      {adding && (
        <form action={action} className="mt-4 rounded-xl2 border border-line bg-surface-100 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="label" htmlFor="new-channel">{c.addPh}</label>
              <input
                id="new-channel" name="label" maxLength={40} autoComplete="off"
                placeholder={c.addPhHint} className="field" autoFocus
              />
            </div>
            <div className="min-w-[150px]">
              <label className="label" htmlFor="new-channel-kind">{c.kind}</label>
              <KindSelect id="new-channel-kind" />
            </div>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? c.saving : c.save}
            </button>
          </div>
          {state && !state.ok && state.error && (
            <p role="alert" className="mt-2 text-[13px] text-bad">{state.error}</p>
          )}
        </form>
      )}

      {channels.length === 0 && !adding ? (
        <p className="mt-5 text-[14px] text-ink-mute">{c.none}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {channels.map((ch) => <Row key={ch.id} channel={ch} origin={origin} />)}
        </ul>
      )}
    </section>
  );
}

/* The evening's own zone, for the same reason every other date on the console
   carries it: a producer in Israel reading "yesterday" off a server in
   Frankfurt is a producer who thinks a channel went quiet a day early. */
const dateFmtFor = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'he-IL', {
  timeZone: EVENT_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
});

function KindSelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  const c = useCopy().channel;
  return (
    <select id={id} name="kind" defaultValue={defaultValue ?? 'instagram'} className="field">
      {CHANNEL_KINDS.map((k) => <option key={k} value={k}>{c.kinds[k]}</option>)}
    </select>
  );
}

function Row({ channel, origin }: { channel: LeadChannel; origin: string }) {
  const c = useCopy().channel;
  const ui = useCopy();
  const [editing, setEditing] = useState(false);
  const url = channelUrl(origin, channel.token);

  /* A channel that is switched off keeps its row and loses its emphasis: the
     producer needs to see that it exists and is not receiving, which a hidden
     row cannot say. */
  const kind = (CHANNEL_KINDS as readonly string[]).includes(channel.source)
    ? c.kinds[channel.source as keyof typeof c.kinds]
    : channel.source;

  return (
    <li className={cn('rounded-xl2 border border-line bg-card p-4', !channel.enabled && 'opacity-60')}>
      {editing ? (
        <EditRow channel={channel} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button" onClick={() => setEditing(true)}
              className="text-[15px] font-semibold text-ink transition hover:text-accent"
              aria-label={`${c.rename}: ${channel.label}`}
            >
              {channel.label}
            </button>
            <p className="mt-0.5 text-[13px] text-ink-mute">
              {kind}
              {' · '}
              <span className={channel.enabled ? 'text-good' : 'text-ink-mute'}>
                {channel.enabled ? c.on : c.off}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <TestButton channelId={channel.id} />

            <form action={setChannelEnabled}>
              <input type="hidden" name="channel_id" value={channel.id} />
              <input type="hidden" name="enabled" value={channel.enabled ? 'off' : 'on'} />
              <button type="submit" className="btn-ghost min-h-[34px] px-3 text-[13px]">
                {channel.enabled ? c.disable : c.enable}
              </button>
            </form>

            <form action={rotateChannel}>
              <input type="hidden" name="channel_id" value={channel.id} />
              <button
                type="submit" title={c.rotateHint} aria-label={c.rotate}
                className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
              >
                <RefreshCw size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </form>

            <DeleteForm action={removeChannel} ask={`${c.remove}: ${channel.label}`}>
              <input type="hidden" name="channel_id" value={channel.id} />
              <button
                type="submit" aria-label={`${c.remove}: ${channel.label}`}
                className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition hover:bg-bad-wash hover:text-bad"
              >
                <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </DeleteForm>
          </div>
        </div>
      )}

      <UrlLine url={url} />

      <Guide kind={channel.source} />

      <p className="mt-2 text-[12.5px] text-ink-mute">
        {channel.last_lead_at
          ? `${c.lastLead}: ${dateFmtFor(ui.locale).format(new Date(channel.last_lead_at))} · ${channel.lead_count} ${c.count}`
          : c.never}
      </p>
    </li>
  );
}

function EditRow({ channel, onDone }: { channel: LeadChannel; onDone: () => void }) {
  const c = useCopy().channel;
  const [state, action, pending] = useActionState<ChannelResult | null, FormData>(
    async (prev, form) => {
      const r = await renameChannel(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="channel_id" value={channel.id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor={`edit-${channel.id}`}>{c.addPh}</label>
          <input
            id={`edit-${channel.id}`} name="label" defaultValue={channel.label}
            maxLength={40} autoComplete="off" className="field" autoFocus
          />
        </div>
        <div className="min-w-[150px]">
          <label className="label" htmlFor={`edit-kind-${channel.id}`}>{c.kind}</label>
          <KindSelect id={`edit-kind-${channel.id}`} defaultValue={channel.source} />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? c.saving : c.saveEdit}
        </button>
        <button
          type="button" onClick={onDone} aria-label={c.close}
          className="grid size-10 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
        >
          <X size={15} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-2 text-[13px] text-bad">{state.error}</p>
      )}
    </form>
  );
}

/**
 * The address, and the press that puts it on the clipboard.
 *
 * One component rather than two, because the fallback needs the element:
 * `navigator.clipboard` is unavailable over plain http and refused by some
 * browsers without a gesture they recognise, and a failure that does nothing
 * visible is indistinguishable from a copy that worked. So a refusal selects
 * the address instead, and the producer presses ctrl+c on something they can
 * see.
 */
function UrlLine({ url }: { url: string }) {
  const c = useCopy().channel;
  const code = useRef<HTMLElement>(null);
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      if (!code.current) return;
      const range = document.createRange();
      range.selectNodeContents(code.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  return (
    <div className="mt-3">
      <p className="label">{c.url}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          ref={code} dir="ltr"
          className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl2 border border-line bg-surface-100 px-3 py-2 text-[12.5px] text-ink-soft"
        >
          {url}
        </code>
        <button type="button" onClick={copy} className="btn-ghost min-h-[38px] shrink-0 px-3.5 text-[13.5px]">
          {done
            ? <Check size={14} strokeWidth={1.5} aria-hidden />
            : <Copy size={14} strokeWidth={1.5} aria-hidden />}
          {done ? c.copied : c.copy}
        </button>
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-mute">{c.urlHint}</p>
    </div>
  );
}

/**
 * The press that answers "is this actually receiving?".
 *
 * The result stays on the row rather than flashing and leaving, because it is
 * the whole reason the button was pressed and because the failures each say
 * what to do next. A refusal in particular is nearly always one thing: the
 * address was replaced here and never re-pasted over there.
 *
 * `aria-live` on the answer rather than a toast: a producer who pressed this
 * with a screen reader asked a question and is waiting for it to be answered.
 */
function TestButton({ channelId }: { channelId: string }) {
  const c = useCopy().channel;
  const [state, action, pending] = useActionState<ChannelResult | null, FormData>(testChannel, null);

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="channel_id" value={channelId} />
        <button type="submit" className="btn-ghost min-h-[34px] px-3 text-[13px]" disabled={pending}>
          {pending ? c.testing : c.test}
        </button>
      </form>

      {state && (
        <p
          role="status" aria-live="polite"
          className={cn(
            'mt-1.5 inline-flex max-w-[260px] items-start gap-1.5 text-[12.5px] leading-snug',
            state.ok ? 'text-good' : 'text-bad',
          )}
        >
          {state.ok
            ? <BadgeCheck size={14} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />
            : <TriangleAlert size={14} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />}
          {state.ok ? c.testOk : state.error}
        </p>
      )}
    </div>
  );
}

/**
 * Where to paste it, on the row that has it.
 *
 * Closed by default and open in one press, for the reason the couple's screen
 * folds: a producer who connected this last month is scrolling past it, and a
 * producer connecting it now has the steps beside the address rather than in
 * a document somebody has to keep.
 *
 * Three sets of steps for eight platforms, because Meta's two consoles are one
 * console and everything else is the same field with a different name.
 */
function Guide({ kind }: { kind: string }) {
  const c = useCopy().channel;
  const steps =
    kind === 'instagram' || kind === 'facebook' ? c.guides.meta
    : kind === 'google_ads' ? c.guides.google
    : c.guides.other;

  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer list-none text-[13px] text-accent transition hover:text-ink">
        {c.guide}
      </summary>
      <ol className="mt-2 space-y-1.5 ps-5 text-[13px] leading-relaxed text-ink-soft [list-style:decimal]">
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </details>
  );
}
