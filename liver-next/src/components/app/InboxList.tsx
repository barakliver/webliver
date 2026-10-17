'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  Mail, MessageCircle, CalendarDays, Upload, Mic, Check, X, Pencil, Paperclip, AlertTriangle, ChevronDown, type LucideIcon,
} from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { approveActions, rejectActions, rematchItem, type InboxResult } from '@/app/actions/inbox';
import { fill } from '@/lib/copyText';
import { cn } from '@/lib/utils';
import { shortDate, clock } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';

/**
 * The box, as cards.
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
    <li className="rounded-card-sm border border-line px-3 py-2">
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

function Card({ item, clients }: { item: InboxItem; clients: { id: string; name: string }[] }) {
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
    <li id={`item-${item.id}`} className="card scroll-mt-24 space-y-3">
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

      {item.ai_summary && <p className="text-body text-ink">{item.ai_summary}</p>}

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
    </li>
  );
}

export function InboxList({ items, clients }: { items: InboxItem[]; clients: { id: string; name: string }[] }) {
  const c = useCopy().inbox;
  const [tab, setTab] = useState<'pending' | 'review' | 'done'>('pending');
  const groups = {
    pending: items.filter((i) => i.status !== 'needs_review' && i.status !== 'ignored' && i.actions.some((a) => a.status === 'pending')),
    review: items.filter((i) => i.status === 'needs_review'),
    done: items.filter((i) => i.status !== 'needs_review' && !i.actions.some((a) => a.status === 'pending')),
  };
  const shown = groups[tab];
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-control border border-line p-0.5" role="tablist">
        {(['pending', 'review', 'done'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('rounded-[10px] px-3 py-1.5 text-body transition-colors duration-touch', tab === t ? 'bg-ink text-card' : 'text-ink-soft hover:text-ink')}>
            {c.tabs[t]} <span className="tabular-nums opacity-70">{groups[t].length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="card text-center text-body text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="list-none space-y-4 p-0">
          {shown.map((item) => <Card key={item.id} item={item} clients={clients} />)}
        </ul>
      )}
    </div>
  );
}
