'use client';

import { useState, useActionState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { addTask, toggleTask, deleteTask, reorderTasks, type TaskResult } from '@/app/actions/tasks';
import { Sortable, Handle } from '@/components/app/Sortable';
import { useCopy } from '@/components/app/CopyProvider';
import { shortDate } from '@/lib/appDates';
import { isPastDue } from '@/lib/clock';
import { EyeOff } from 'lucide-react';
import { PlanOffer } from '@/components/app/PlanOffer';
import { VendorCaptureModal } from '@/components/portal/VendorCaptureModal';
import { pressOnCircle } from '@/content/eventFile';

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
  const [showVendorModal, setShowVendorModal] = useState(false);
  /* The circle answers the press before the server does. A tick is a server
     action, a revalidation of three paths and a re-render, which on a phone in
     a hall is a second or more of a circle that looks exactly as it did — so
     it gets pressed again, and the second press unticks what the first one
     ticked. Shown ticked while the call is in flight, and the real answer
     replaces it when it lands. */
  const [ticking, setTicking] = useState(false);
  const ui = useCopy();
  const c = ui.tasks;
  const dateFmt = shortDate(ui.locale);
  const done = ticking ? !task.done : task.done;
  const late = !done && isOverdue(task.due_on);
  const ownerLabel =
    viewer === 'producer'
      ? (task.owner === 'producer' ? c.ownerProducer : c.ownerClient)
      : (task.owner === 'producer' ? c.ownerProducerClientView : c.ownerClientClientView);

  /* What the press means, decided beside the list of supplier categories it
     reads. It was decided here, against a second copy of that list nine
     categories long with neither makeup nor a rabbi in it. */
  const press = pressOnCircle(task);

  /* The one place the tick is written, wherever the press came from: the
     circle, the supplier form's save, or its "tick without a supplier". It
     was three places, and two of them wrote the row straight from the browser
     and then closed the form — the task was done in the database and open on
     the screen, which is a button that does nothing as far as anybody
     pressing it can tell. The server action is what revalidates the couple's
     screen, the producer's, and the overview. */
  const tick = async () => {
    if (ticking) return;
    setTicking(true);
    try {
      const formData = new FormData();
      formData.append('task_id', task.id);
      formData.append('client_id', clientId);
      formData.append('done', String(task.done));
      await toggleTask(formData);
    } finally {
      setTicking(false);
    }
  };

  const handleToggleClick = async () => {
    if (press === 'capture') setShowVendorModal(true);
    else await tick();
  };

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
            onClick={handleToggleClick}
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
      </div>

        {canDelete && (
          <form action={deleteTask}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.remove}</button>
          </form>
        )}
      </div>

      {/* Show vendor capture modal when task marked done */}
      {showVendorModal && task.event_id && task.category && (
        <VendorCaptureModal
          task={{
            id: task.id,
            client_id: clientId,
            event_id: task.event_id,
            title: task.title,
            due_on: task.due_on,
            done: task.done,
            owner: task.owner,
            created_by: task.created_by,
            created_at: new Date().toISOString(),
            category: task.category,
            vendor_id: task.vendor_id ?? null,
          }}
          template={{
            id: '',
            event_type: task.category,
            title: task.title,
            description: '',
            is_vendor_task: true,
            vendor_category: task.category,
            ask_name: true,
            ask_cost: true,
            ask_phone: true,
            ask_contact_name: false,
            ask_location: false,
            ask_notes: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
          }}
          eventId={task.event_id}
          onClose={() => setShowVendorModal(false)}
          /* Both ways out of the form that mean "it is done" tick the same
             way. The form's own job ends at the supplier. */
          onSaved={async () => { setShowVendorModal(false); await tick(); }}
          onSkip={async () => { setShowVendorModal(false); await tick(); }}
        />
      )}
    </>
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
