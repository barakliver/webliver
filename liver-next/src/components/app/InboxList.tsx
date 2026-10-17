'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  Mail, MessageCircle, CalendarDays, Upload, Mic, Check, X, Pencil, Paperclip, AlertTriangle, ChevronDown, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { approveActions, rejectActions, rematchItem, type InboxResult } from '@/app/actions/inbox';
import { fill } from '@/lib/copyText';
import { cn } from '@/lib/utils';
import { shortDate, clock } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { useDesk } from '@/lib/useWide';

/**
 * The box: a list of what arrived and the one that is open.
 *
 * From a laptop up the list is a column and the open one is beside it, so
 * moving down the morning is one press per message and the answer never
 * leaves the screen. On a phone it is the list, and a press opens the
 * message with a way back. The same detail either way.
 *
 * The detail, as it has always been:
 *
 * One card per thing that arrived: who sent it, which event it is about
 * (a chip that can be changed, because the match is a guess), the one
 * sentence the reading made of it, and under that every proposal with a
 * box beside it. Approve all, approve the ticked ones, reject, open the
 * source. A card whose event could not be told is the sorting box: the
 * same card with a select where the chip would be.
 *
 * A proposal can be edited before the yes. The edit is the payload as
 * JSON, deliberately plain: the fields are the columns, and a form per
 * kind would be eleven forms to keep true. What was edited is kept beside
 * what was proposed, which is the one thing that teaches the prompt.
 */

export type InboxAction = {
  id: string; kind: string; title: string; payload: Record<string, unknown>; confidence: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed'; error: string;
};

export type InboxItem = {
  id: string; channel: 'email' | 'whatsapp' | 'calendar' | 'upload' | 'voice';
  from_identity: string; from_name: string; subject: string; body_text: string;
  attachments: { name: string; mime: string; path: string; size: number }[];
  received_at: string; client_id: string | null; client_name: string | null;
  match_confidence: string; match_reason: string; status: string; ai_summary: string; category: string;
  needs_human?: boolean;
  actions: InboxAction[];
};

const CHANNEL_ICON: Record<InboxItem['channel'], LucideIcon> = {
  email: Mail, whatsapp: MessageCircle, calendar: CalendarDays, upload: Upload, voice: Mic,
};

function Busy({ idle, className }: { idle: string; className: string }) {
  const c = useCopy().inbox.action;
  const { pending } = useFormStatus();
  return <button type="submit" className={cn(className, 'disabled:opacity-60')} disabled={pending}>{pending ? c.working : idle}</button>;
}

function ActionRow({ a, checked, onCheck }: { a: InboxAction; checked: boolean; onCheck: (v: boolean) => void }) {
  const c = useCopy().inbox.action;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(JSON.stringify(a.payload, null, 2));
  const open = a.status === 'pending';
  const tone = a.status === 'applied' ? 'text-ok' : a.status === 'failed' ? 'text-bad' : a.status === 'rejected' ? 'text-ink-mute line-through' : 'text-ink';
  return (
    <li className="rounded-card-sm bg-surface-200 px-4 py-3">
      <div className="flex items-start gap-2">
        {open ? (
          <input type="checkbox" name="action_id" value={a.id} checked={checked} onChange={(e) => onCheck(e.target.checked)}
            className="mt-1 size-4 shrink-0" aria-label={a.title} />
        ) : (
          <span className={cn('mt-0.5 shrink-0', tone)} aria-hidden>
            {a.status === 'applied' ? <Check size={15} /> : a.status === 'failed' ? <AlertTriangle size={15} /> : <X size={15} />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('text-body', tone)}>{a.title}</p>
          <p className="text-micro text-ink-mute">
            {a.confidence !== null && `${c.confidence} ${Math.round(a.confidence * 100)}%`}
            {!open && ` · ${c[a.status === 'approved' ? 'pending' : a.status]}`}
            {a.error && ` · ${a.error}`}
          </p>
          {editing && (
            <>
              <textarea name={`payload_${a.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={5} dir="ltr"
                className="field mt-2 font-mono text-meta" aria-label={c.edit} />
              <p className="text-micro text-ink-mute">{c.editHint}</p>
            </>
          )}
        </div>
        {open && (
          <button type="button" onClick={() => setEditing((v) => !v)} aria-label={c.edit} title={c.edit}
            className="btn-quiet grid size-8 shrink-0 place-items-center px-0 py-0">
            <Pencil size={14} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

function Detail({ item, clients }: { item: InboxItem; clients: { id: string; name: string }[] }) {
  const ui = useCopy();
  const c = ui.inbox;
  const dateFmt = shortDate(ui.locale);
  const timeFmt = clock(ui.locale);
  const Icon = CHANNEL_ICON[item.channel] ?? Mail;
  const [open, setOpen] = useState(false);
  const pendingIds = item.actions.filter((a) => a.status === 'pending').map((a) => a.id);
  const [checked, setChecked] = useState<Set<string>>(new Set(pendingIds));
  const [approve, approveAction] = useActionState<InboxResult | null, FormData>(approveActions, null);
  const [reject, rejectAction] = useActionState<InboxResult | null, FormData>(rejectActions, null);
  const [match, matchAction] = useActionState<InboxResult | null, FormData>(rematchItem, null);
  const sorting = item.status === 'needs_review' || (!item.client_id && item.status !== 'ignored');
  const when = `${formatDate(dateFmt, item.received_at.slice(0, 10), '')} ${timeFmt.format(new Date(item.received_at))}`;
  const conf = (c.item.confidence as Record<string, string>)[item.match_confidence];

  return (
    <div id={`item-${item.id}`} className="card scroll-mt-24 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-200 text-ink-mute">
          <Icon size={18} strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lead font-medium text-ink">{item.from_name || item.from_identity || c.channels[item.channel]}</p>
          <p className="text-meta text-ink-mute">
            {c.channels[item.channel]} · {when}
            {item.category && ` · ${(c.categories as Record<string, string>)[item.category] ?? item.category}`}
          </p>
        </div>
        {item.needs_human && <span className="chip-warn">{c.item.needsHuman}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-body">
        <span className="text-ink-soft">{c.item.about}</span>
        {item.client_id && !sorting ? (
          <Link href={`/app/clients/${item.client_id}`} className="chip-ok">{item.client_name ?? item.client_id}</Link>
        ) : null}
        <form action={matchAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="item_id" value={item.id} />
          <select name="client_id" defaultValue={item.client_id ?? ''} aria-label={c.item.pick} className="field w-auto py-1 text-meta">
            <option value="">{sorting ? c.item.pick : c.item.pick}</option>
            {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            <option value="none">{c.item.notRelated}</option>
          </select>
          <Busy idle={c.item.assign} className="btn-ghost px-3 py-1 text-meta" />
          {match && !match.ok && <span role="alert" className="text-meta text-bad">{match.error}</span>}
        </form>
        {conf && <span className="text-micro text-ink-mute">{conf}{item.match_reason ? ` · ${item.match_reason}` : ''}</span>}
      </div>

      {sorting && <p className="rounded-card-sm bg-warn-wash px-3 py-2 text-body text-warn">{c.item.unknown}</p>}

      {/* The sentence the reading made of it, as large as anything on the
          screen: it is the thing the producer came to read, and the rows
          under it are only what follows from it. */}
      {item.ai_summary && <p className="font-display text-figure font-light leading-snug text-ink">{item.ai_summary}</p>}

      <form action={approveAction} className="space-y-2">
        <input type="hidden" name="item_id" value={item.id} />
        {item.actions.length === 0 ? (
          <p className="text-meta text-ink-mute">{c.item.noActions}</p>
        ) : (
          <ul className="list-none space-y-2 p-0">
            {item.actions.map((a) => (
              <ActionRow key={a.id} a={a} checked={checked.has(a.id)}
                onCheck={(v) => setChecked((prev) => { const n = new Set(prev); if (v) n.add(a.id); else n.delete(a.id); return n; })} />
            ))}
          </ul>
        )}
        {pendingIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Approve the ticked ones. With every box ticked that is all of them. */}
            <Busy idle={checked.size === pendingIds.length ? c.action.approveAll : c.action.approveSelected} className="btn-primary" />
            <button type="submit" formAction={rejectAction} className="btn-ghost">{checked.size === pendingIds.length ? c.action.rejectAll : c.action.reject}</button>
            {approve?.ok && <span className="text-body text-ok">{approve.failed ? fill(c.action.someFailed, { n: approve.applied ?? 0, m: approve.failed }) : fill(c.action.done, { n: approve.applied ?? 0 })}</span>}
            {approve && !approve.ok && <span role="alert" className="text-body text-bad">{approve.error}</span>}
            {reject && !reject.ok && <span role="alert" className="text-body text-bad">{reject.error}</span>}
          </div>
        )}
      </form>

      <div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-quiet inline-flex items-center gap-1 px-0 text-meta">
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          {open ? c.item.close : c.item.open}
          {item.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={12} aria-hidden />{item.attachments.length}</span>}
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            {item.subject && <p className="text-body font-medium text-ink">{item.subject}</p>}
            <p className="whitespace-pre-line rounded-card-sm bg-surface-100 px-3 py-2 text-body text-ink-soft">{item.body_text || '·'}</p>
            {item.attachments.length > 0 && (
              <p className="text-meta text-ink-mute">{c.item.attachments}: {item.attachments.map((a) => a.name).join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* One line of the list: who, how long ago, the sentence, and how many things
   are waiting on a yes. The open one sits on the card colour. */
function Row({ item, selected, onPress }: { item: InboxItem; selected: boolean; onPress: () => void }) {
  const ui = useCopy();
  const c = ui.inbox;
  const Icon = CHANNEL_ICON[item.channel] ?? Mail;
  const waiting = item.actions.filter((a) => a.status === 'pending').length;
  const dateFmt = shortDate(ui.locale);
  return (
    <li>
      <button type="button" onClick={onPress} aria-current={selected ? 'true' : undefined}
        className={cn('flex w-full items-start gap-3 rounded-card px-4 py-3.5 text-start transition-colors duration-touch',
          selected ? 'bg-card' : 'hover:bg-surface-100')}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-200 text-ink-mute">
          <Icon size={18} strokeWidth={1.5} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-lead text-ink">{item.from_name || item.from_identity || c.channels[item.channel]}</span>
            <span className="shrink-0 text-micro text-ink-mute">{formatDate(dateFmt, item.received_at.slice(0, 10), '')}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-meta text-ink-mute">{item.ai_summary || item.subject || item.body_text}</span>
          <span className={cn('mt-2 inline-block rounded-full px-2.5 py-0.5 text-micro',
            waiting > 0 ? 'bg-accent-wash text-accent' : 'border border-line text-ink-mute')}>
            {waiting > 0 ? fill(c.counts.pending, { n: waiting }) : c.item.logged}
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="mt-1 shrink-0 text-ink-mute lg:hidden rtl:rotate-180" />
      </button>
    </li>
  );
}

export function InboxList({ items, clients }: { items: InboxItem[]; clients: { id: string; name: string }[] }) {
  const ui = useCopy();
  const c = ui.inbox;
  const [tab, setTab] = useState<'pending' | 'review' | 'done'>('pending');
  const [sel, setSel] = useState<string | null>(null);
  /* Null until the browser has said how wide it is: the desk is what the
     server drew, and the phone's list is the same rows without the pane. */
  const desk = useDesk();
  const groups = {
    pending: items.filter((i) => i.status !== 'needs_review' && i.status !== 'ignored' && i.actions.some((a) => a.status === 'pending')),
    review: items.filter((i) => i.status === 'needs_review'),
    done: items.filter((i) => i.status !== 'needs_review' && !i.actions.some((a) => a.status === 'pending')),
  };
  const shown = groups[tab];

  /* A link to one message (`#item-<id>`) opens that message, on the tab it
     is on. Without this the anchor lands on a pane that was never drawn. */
  useEffect(() => {
    const m = /^#item-(.+)$/.exec(window.location.hash);
    if (!m) return;
    const hit = items.find((i) => i.id === m[1]);
    if (!hit) return;
    const t = (['pending', 'review', 'done'] as const).find((k) => groups[k].some((i) => i.id === hit.id));
    if (t) setTab(t);
    setSel(hit.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* On a desk something is always open: the one pressed, or the first. Once
     what was open has been handled and left the tab, the next takes its place. */
  const current = shown.find((i) => i.id === sel) ?? (desk === false ? undefined : shown[0]);

  const list = (
    <ul className="m-0 list-none space-y-1 p-0">
      {shown.map((item) => <Row key={item.id} item={item} selected={current?.id === item.id && desk !== false} onPress={() => setSel(item.id)} />)}
    </ul>
  );

  return (
    <div className="space-y-5">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-200 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {(['pending', 'review', 'done'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSel(null); }}
            className={cn('min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-body transition-colors duration-touch', tab === t ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink')}>
            {c.tabs[t]} <span className="tabular-nums opacity-70">{groups[t].length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="card text-center text-body text-ink-mute">{c.empty}</p>
      ) : desk === false ? (
        current ? (
          <div className="space-y-3">
            <button type="button" onClick={() => setSel(null)} className="btn-quiet inline-flex items-center gap-1 px-0 text-body">
              <ChevronRight size={15} strokeWidth={1.5} aria-hidden className="rtl:rotate-0 ltr:rotate-180" />{c.title}
            </button>
            <Detail key={current.id} item={current} clients={clients} />
          </div>
        ) : list
      ) : (
        <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start gap-7">
          {list}
          {current && <Detail key={current.id} item={current} clients={clients} />}
        </div>
      )}
    </div>
  );
}
