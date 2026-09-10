'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { X, Plus, Pencil, CalendarHeart, CheckCircle2, Wallet, NotebookPen } from 'lucide-react';
import type { CalItem } from '@/lib/calendar';
import { addDiaryEntry, updateDiaryEntry, deleteDiaryEntry, type DiaryResult } from '@/app/actions/diary';
import { useCopy } from '@/components/app/CopyProvider';
import { Money } from '@/components/Ltr';

/**
 * One day, opened from the grid.
 *
 * What the day already holds, each line a link to where it lives, and
 * under it the one form the calendar did not have: a thing of the
 * producer's own on that day. A title, a time or all day, an event when
 * there is one, a note. Entries are edited in place and deleted with one
 * press; everything else on the day is edited where it came from.
 */

export type DiaryEntryRow = {
  id: string; client_id: string | null; title: string; on_date: string; at_time: string | null; duration_min: number; note: string;
};

const ICON = { event: CalendarHeart, task: CheckCircle2, payment: Wallet, entry: NotebookPen };
const TONE: Record<CalItem['kind'], string> = {
  event: 'bg-accent-wash text-accent',
  task: 'bg-surface-200 text-ink-soft',
  payment: 'bg-warn-wash text-warn',
  entry: 'bg-ok-wash text-ok',
};

function Save() {
  const c = useCopy().calendar.day;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

function EntryForm({ day, entry, clients, onDone }: {
  day: string; entry?: DiaryEntryRow; clients: { id: string; name: string }[]; onDone?: () => void;
}) {
  const c = useCopy().calendar.day;
  const [state, action] = useActionState<DiaryResult | null, FormData>(entry ? updateDiaryEntry : addDiaryEntry, null);
  const [allDay, setAllDay] = useState(!entry?.at_time);
  /* After a save the row re-renders from the server; the form folds. */
  useEffect(() => { if (state?.ok && onDone) onDone(); }, [state, onDone]);

  return (
    <form action={action} className="grid gap-3 rounded-xl2 border border-line bg-surface-100 p-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <label className="grid gap-1 text-[13px] text-ink-soft">{c.titleLabel}
        <input name="title" required defaultValue={entry?.title ?? ''} placeholder={c.titlePh} className="field" autoFocus={!entry} /></label>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <label className="grid gap-1 text-[13px] text-ink-soft">{c.time}
          <input name="on_date" type="date" defaultValue={entry?.on_date ?? day} className="field" aria-label={c.time} /></label>
        <label className="grid gap-1 text-[13px] text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4" />
            {c.allDay}
          </span>
          <input name="at_time" type="time" defaultValue={entry?.at_time?.slice(0, 5) ?? ''} disabled={allDay} className="field" aria-label={c.time} />
        </label>
        <label className="grid gap-1 text-[13px] text-ink-soft">{c.duration}
          <span className="flex items-center gap-2">
            <input name="duration_min" type="number" min={5} max={1440} step={5} defaultValue={entry?.duration_min ?? 60} disabled={allDay} className="field w-24 tabular-nums" />
            <span className="text-[13px] text-ink-mute">{c.minutes}</span>
          </span>
        </label>
      </div>
      <label className="grid gap-1 text-[13px] text-ink-soft">{c.event}
        <select name="client_id" defaultValue={entry?.client_id ?? ''} className="field">
          <option value="">{c.noEvent}</option>
          {clients.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-[13px] text-ink-soft">{c.note}
        <textarea name="note" rows={2} defaultValue={entry?.note ?? ''} className="field" /></label>
      {state && !state.ok && state.error && <p role="alert" className="text-[14px] text-bad">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Save />
        {onDone && <button type="button" onClick={onDone} className="btn-quiet text-[14px]">{c.cancel}</button>}
      </div>
    </form>
  );
}

export function DayDrawer({ day, dayText, items, entries, clients }: {
  day: string;
  /** The day written out, in the reader's language. */
  dayText: string;
  items: CalItem[];
  entries: DiaryEntryRow[];
  clients: { id: string; name: string }[];
}) {
  const c = useCopy().calendar.day;
  const [adding, setAdding] = useState(items.length === 0);
  const [editing, setEditing] = useState<string | null>(null);
  const entryOf = new Map(entries.map((e) => [e.id, e]));

  return (
    <section className="card border-accent" aria-label={c.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{c.title}</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold text-ink">{dayText}</h2>
        </div>
        <Link href="/app/calendar" className="btn-quiet inline-flex items-center gap-1.5 text-[14px]" aria-label={c.close}>
          <X size={16} aria-hidden strokeWidth={1.5} />{c.close}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-[14.5px] text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((i) => {
            const Icon = ICON[i.kind];
            const row = i.kind === 'entry' && i.rowId ? entryOf.get(i.rowId) : undefined;
            if (row && editing === row.id) {
              return <li key={i.id}><EntryForm day={day} entry={row} clients={clients} onDone={() => setEditing(null)} /></li>;
            }
            return (
              <li key={i.id} className={`flex items-center gap-3 rounded-xl2 px-3 py-2.5 ${TONE[i.kind]}`}>
                {i.color
                  ? <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
                  : <Icon size={16} aria-hidden strokeWidth={1.5} className="shrink-0" />}
                <span className="min-w-0 flex-1">
                  {row ? (
                    <span className={`block truncate text-[15px] ${i.done ? 'line-through opacity-60' : ''}`}>{i.title}</span>
                  ) : (
                    <Link href={i.href} className={`block truncate text-[15px] hover:underline ${i.done ? 'line-through opacity-60' : ''}`}>{i.title}</Link>
                  )}
                  {i.detail && <span className="block truncate text-[13px] opacity-75">{i.detail}</span>}
                </span>
                {i.amount ? <span className="shrink-0 text-[14px] tabular-nums"><Money value={i.amount} /></span> : null}
                {row && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => setEditing(row.id)} className="grid size-8 place-items-center rounded-xl2 hover:bg-surface-200" aria-label={c.edit} title={c.edit}>
                      <Pencil size={14} aria-hidden strokeWidth={1.5} />
                    </button>
                    <form action={deleteDiaryEntry}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="grid size-8 place-items-center rounded-xl2 hover:bg-surface-200" aria-label={c.remove} title={c.remove}>
                        <X size={14} aria-hidden strokeWidth={1.5} />
                      </button>
                    </form>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        {adding ? (
          <EntryForm day={day} clients={clients} onDone={items.length === 0 ? undefined : () => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="btn-ghost inline-flex items-center gap-2 text-[14px]">
            <Plus size={16} aria-hidden strokeWidth={1.5} />{c.add}
          </button>
        )}
      </div>
      <p className="mt-3 text-[12.5px] text-ink-mute">{c.hint}</p>
    </section>
  );
}
