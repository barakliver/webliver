'use client';

import { useActionState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { addTask, toggleTask, deleteTask, type TaskResult } from '@/app/actions/tasks';
import { appCopy, templateCopy } from '@/content/site';
import { EyeOff } from 'lucide-react';

export type Task = {
  /** False keeps it on the producer's side. The couple never receives these
   *  rows at all, so the flag is only ever read on the producer's screen. */
  visible_to_client?: boolean;
  id: string;
  title: string;
  due_on: string | null;
  done: boolean;
  owner: 'producer' | 'client';
  created_by: string | null;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Compared on calendar dates, so a task due today is never shown as late
 *  merely because it is the evening. */
function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(due);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) < today;
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? appCopy.tasks.adding : appCopy.tasks.add}
    </button>
  );
}

function Row({ task, clientId, viewer, canDelete }: {
  task: Task; clientId: string; viewer: 'producer' | 'client'; canDelete: boolean;
}) {
  const c = appCopy.tasks;
  const late = !task.done && isOverdue(task.due_on);
  const ownerLabel =
    viewer === 'producer'
      ? (task.owner === 'producer' ? c.ownerProducer : c.ownerClient)
      : (task.owner === 'producer' ? c.ownerProducerClientView : c.ownerClientClientView);

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl2 border px-4 py-3 ${
      late ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
    }`}>
      <form action={toggleTask} className="flex items-center">
        <input type="hidden" name="task_id" value={task.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="done" value={String(task.done)} />
        <button
          type="submit"
          aria-label={task.title}
          aria-pressed={task.done}
          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[13px] transition ${
            task.done ? 'border-ok/30 bg-ok text-surface' : 'border-line-strong bg-card hover:border-ink'
          }`}
        >
          {task.done ? '✓' : ''}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`text-[15px] ${task.done ? 'text-ink-mute line-through' : 'text-ink'}`}>
          {task.title}
          {/* Only ever rendered on the producer's screen: a couple is never
              sent these rows in the first place, so the absence of a badge on
              their list is the policy and not a styling choice. */}
          {task.visible_to_client === false && (
            <span
              className="ms-2 inline-flex items-center gap-1 align-middle rounded-xl2 bg-surface-200 px-2 py-0.5 text-[11.5px] text-ink-mute"
              title={templateCopy.privateNote}
            >
              <EyeOff size={11} aria-hidden strokeWidth={1.5} />
              {templateCopy.sharedOff}
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
      </div>

      {canDelete && (
        <form action={deleteTask}>
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.remove}</button>
        </form>
      )}
    </li>
  );
}

export function TaskList({ clientId, tasks, viewer, viewerId }: {
  clientId: string; tasks: Task[]; viewer: 'producer' | 'client'; viewerId: string;
}) {
  const [state, action] = useActionState<TaskResult | null, FormData>(addTask, null);
  const c = appCopy.tasks;

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  /* The database allows a producer to delete anything on their own workspace
     and everyone else only their own, so the button follows the same rule
     rather than offering an action that would be refused. */
  const mayDelete = (t: Task) => viewer === 'producer' || t.created_by === viewerId;

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-light text-ink">{c.title}</h2>
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
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <>
          <h3 className="mt-7 text-[13px] font-semibold text-accent">{c.open} · {open.length}</h3>
          <ul className="mt-3 space-y-2">
            {open.map((t) => <Row key={t.id} task={t} clientId={clientId} viewer={viewer} canDelete={mayDelete(t)} />)}
          </ul>

          {done.length > 0 && (
            <>
              <h3 className="mt-7 text-[13px] font-semibold text-ink-mute">{c.done} · {done.length}</h3>
              <ul className="mt-3 space-y-2">
                {done.map((t) => <Row key={t.id} task={t} clientId={clientId} viewer={viewer} canDelete={mayDelete(t)} />)}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
