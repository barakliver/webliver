'use client';

import { useState, useActionState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { addTask, deleteTask, updateTask, reorderTasks, type TaskResult } from '@/app/actions/tasks';
import { Sortable, Handle } from '@/components/app/Sortable';
import { useCopy } from '@/components/app/CopyProvider';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { shortDate } from '@/lib/appDates';
import { isPastDue } from '@/lib/clock';
import { EyeOff, Pencil } from 'lucide-react';
import { PlanOffer } from '@/components/app/PlanOffer';
import { useTaskPress } from '@/components/app/TaskPress';

export type Task = {
  /** False keeps it on the producer's side. The couple never receives these
   *  rows at all, so the flag is only ever read on the producer's screen. */
  visible_to_client?: boolean;
  id: string;
  title: string;
  due_on: string | null;
  done: boolean;
  owner: 'producer' | 'client';
  /** A line of context, written when the task is edited. Empty is normal. */
  notes?: string;
  created_by: string | null;
  event_id?: string;
  category?: string;
  vendor_id?: string | null;
};


/** Compared on calendar dates where the event is, so a task due today is
 *  never shown as late merely because it is the evening — and so the server
 *  and the phone reach the same verdict. Reading "today" off whichever
 *  machine was asking meant a server in UTC called a row on time while the
 *  producer's phone called it overdue, and React threw the page away. */
const isOverdue = (due: string | null): boolean => isPastDue(due);

function AddButton() {
  const ui = useCopy();
  const c = ui.tasks;
  const dateFmt = shortDate(ui.locale);
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? c.adding : c.add}
    </button>
  );
}

/* A row rather than a list item, because the sortable list supplies the item
   and the finished list supplies its own. One row, drawn the same way in
   both, is worth more than two that drift. */
function Row({ task, clientId, viewer, canDelete, grip }: {
  task: Task; clientId: string; viewer: 'producer' | 'client'; canDelete: boolean;
  grip?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  /* What the press means, what it draws while the server catches up, and the
     supplier form behind a supplier task: all of it beside the tick itself,
     because the bingo board presses the same rows and the two screens must
     never disagree about what pressing one does. */
  const { done, ticking, press, captureForm } = useTaskPress(task, clientId);
  const ui = useCopy();
  const c = ui.tasks;
  const dateFmt = shortDate(ui.locale);
  const late = !done && isOverdue(task.due_on);
  const ownerLabel =
    viewer === 'producer'
      ? (task.owner === 'producer' ? c.ownerProducer : c.ownerClient)
      : (task.owner === 'producer' ? c.ownerProducerClientView : c.ownerClientClientView);

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 rounded-xl2 border px-3 py-3 ${
        late ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
      }`}>
        {grip}
        <div className="flex items-center">
          {/* The circle stays 24px and the target around it grows to 44 tall by
              32 wide. It was the button itself at 24 square, which is the most
              tapped control in the product drawn at half the size a finger
              needs. Tall rather than square on purpose: the row already has the
              height to spare and none of the width, and a 44px square pushed
              every task title into wrapping a line earlier. */}
          <button
            type="button"
            onClick={press}
            disabled={ticking}
            aria-label={task.title}
            aria-pressed={done}
            className="-my-2 -mx-1 flex h-11 w-8 items-center justify-center"
          >
            <span
              aria-hidden
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[13px] transition ${
                done ? 'border-ok/30 bg-ok text-surface' : 'border-line-strong bg-card hover:border-ink'
              }`}
            >
              {done ? '✓' : ''}
            </span>
          </button>
        </div>

      <div className="min-w-0 flex-1">
        <p className={`text-[15px] ${done ? 'text-ink-mute line-through' : 'text-ink'}`}>
          {task.title}
          {/* Only ever rendered on the producer's screen: a couple is never
              sent these rows in the first place, so the absence of a badge on
              their list is the policy and not a styling choice. */}
          {task.visible_to_client === false && (
            <span
              className="ms-2 inline-flex items-center gap-1 align-middle rounded-xl2 bg-surface-200 px-2 py-0.5 text-[11.5px] text-ink-mute"
              title={ui.template.privateNote}
            >
              <EyeOff size={11} aria-hidden strokeWidth={1.5} />
              {ui.template.sharedOff}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-mute">
          <span className={late ? 'font-semibold text-bad' : ''}>
            {formatDate(dateFmt, task.due_on, c.noDue)}
            {late ? ` · ${c.overdue}` : ''}
          </span>
          {' · '}{ownerLabel}
        </p>
        {task.notes && (
          <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-ink-soft">{task.notes}</p>
        )}
      </div>

        {/* Editing after writing: the title, the date, whose it is, and a
            note. It used to be tick or delete and nothing in between, so a
            typo in a task was a task deleted and written again. */}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-[13px]"
        >
          <Pencil size={13} aria-hidden strokeWidth={1.5} />
          {c.edit}
        </button>
        {canDelete && (
          <DeleteForm action={deleteTask}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.remove}</button>
          </DeleteForm>
        )}
      </div>

      {editing && (
        <EditForm task={task} clientId={clientId} viewer={viewer} onDone={() => setEditing(false)} />
      )}

      {captureForm}
    </>
  );
}

function SaveEdit() {
  const c = useCopy().tasks;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.editSaving : c.editSave}
    </button>
  );
}

/** The four things a task is, editable in place under its row. The owner
 *  labels are the viewer's own words for the two sides, the same ones the
 *  row uses, so "ours" means the same thing above and below the line. */
function EditForm({ task, clientId, viewer, onDone }: {
  task: Task; clientId: string; viewer: 'producer' | 'client'; onDone: () => void;
}) {
  const c = useCopy().tasks;
  const [state, action] = useActionState<TaskResult | null, FormData>(
    async (prev, form) => {
      const r = await updateTask(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );
  const ownerLabel = (o: 'producer' | 'client') =>
    viewer === 'producer'
      ? (o === 'producer' ? c.ownerProducer : c.ownerClient)
      : (o === 'producer' ? c.ownerProducerClientView : c.ownerClientClientView);

  return (
    <form action={action} noValidate className="mt-3 grid gap-3 rounded-xl2 border border-line bg-surface-100 p-4 sm:grid-cols-2">
      <input type="hidden" name="task_id" value={task.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-[14px] font-medium text-ink sm:col-span-2">{c.editTitle}</p>
      {state && !state.ok && state.error && (
        <p role="alert" className="rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad sm:col-span-2">{state.error}</p>
      )}
      <label className="grid gap-1 text-[12.5px] text-ink-mute sm:col-span-2">{c.titlePh}
        <input name="title" required maxLength={200} defaultValue={task.title} className="field" autoComplete="off" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.due}
        <input name="due_on" type="date" defaultValue={task.due_on ?? ''} className="field" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.owner}
        <select name="owner" defaultValue={task.owner} className="field">
          <option value="producer">{ownerLabel('producer')}</option>
          <option value="client">{ownerLabel('client')}</option>
        </select></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute sm:col-span-2">{c.notes}
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={task.notes ?? ''} placeholder={c.notesPh} className="field" /></label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <SaveEdit />
        <button type="button" onClick={onDone} className="btn-ghost">{c.editCancel}</button>
      </div>
    </form>
  );
}

export function TaskList({ clientId, tasks, viewer, viewerId }: {
  clientId: string; tasks: Task[]; viewer: 'producer' | 'client'; viewerId: string;
}) {
  const [state, action] = useActionState<TaskResult | null, FormData>(addTask, null);
  const ui = useCopy();
  const c = ui.tasks;
  const dateFmt = shortDate(ui.locale);

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  /* The database allows a producer to delete anything on their own workspace
     and everyone else only their own, so the button follows the same rule
     rather than offering an action that would be refused. */
  const mayDelete = (t: Task) => viewer === 'producer' || t.created_by === viewerId;

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{viewer === 'producer' ? c.subProducer : c.subClient}</p>

      <form action={action} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input type="hidden" name="client_id" value={clientId} />
        <input name="title" required placeholder={c.titlePh} autoComplete="off" className="field" aria-label={c.titlePh} />
        <input name="due_on" type="date" className="field sm:w-[150px]" aria-label={c.due} />
        <select name="owner" defaultValue={viewer} className="field sm:w-[120px]" aria-label={c.owner}>
          <option value="producer">{viewer === 'producer' ? c.ownerProducer : c.ownerProducerClientView}</option>
          <option value="client">{viewer === 'producer' ? c.ownerClient : c.ownerClientClientView}</option>
        </select>
        <AddButton />
      </form>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}

      {tasks.length === 0 ? (
        /* The producer gets the offer to build a plan; the couple gets the
           sentence. Twenty-eight production steps are not theirs to start,
           and half of them are things they would rather not know had to be
           chased. */
        viewer === 'producer'
          ? <PlanOffer clientId={clientId} />
          : <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <>
          <h3 className="mt-7 text-[13px] font-semibold text-accent">{c.open} · {open.length}</h3>
          {/* The order here is a decision, not a sort. What matters this week
              is not the three with the earliest dates; it is the three the
              person doing them decided matter. The finished list below stays a
              plain list, because putting completed work in a preferred order
              is not a thing anybody means to do. */}
          <Sortable
            items={open}
            onReorder={async (ids) => {
              const res = await reorderTasks(clientId, ids);
              if (!res.ok) throw new Error(res.error);
            }}
            announce={(id, at, of) =>
              `${open.find((t) => t.id === id)?.title ?? ''} · מיקום ${at} מתוך ${of}`}
            className="mt-3 space-y-2"
          >
            {(t, { handle }) => (
              <Row
                task={t} clientId={clientId} viewer={viewer} canDelete={mayDelete(t)}
                grip={<Handle label={c.reorder} {...handle} />}
              />
            )}
          </Sortable>

          {done.length > 0 && (
            <>
              <h3 className="mt-7 text-[13px] font-semibold text-ink-mute">{c.done} · {done.length}</h3>
              <ul className="mt-3 space-y-2">
                {done.map((t) => (
                  <li key={t.id}>
                    <Row task={t} clientId={clientId} viewer={viewer} canDelete={mayDelete(t)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
