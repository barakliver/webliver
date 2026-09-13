'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCheck, Pencil, Repeat as RepeatIcon } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { shortDate } from '@/lib/appDates';
import { fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { standing, type ProducerTask, type Repeat } from '@/lib/producerTasks';
import {
  addMyTask, updateMyTask, toggleMyTask, deleteMyTask, type MyTaskResult,
} from '@/app/actions/producerTasks';

/**
 * The producer's own list.
 *
 * Every task in this product belonged to a wedding, and about half of what he
 * actually does in a week does not: the VAT, the insurance, calling the
 * lighting company back, emptying the van. That half was living on paper and
 * in the phone's reminders — a second list the screen he opens every morning
 * knew nothing about.
 *
 * The part that is not just another task list is the repeat. He asked for the
 * things he has to do "באופן שוטף", and a routine written as a one-off is a
 * task somebody retypes every month until they stop retyping it. So a row can
 * be a routine, and ticking a routine does not finish it: it records the day
 * and moves to the next occurrence. One row carries "every Sunday" for its
 * whole life.
 *
 * Which makes the tick mean two different things, and the button says which:
 * a one-off gets a circle that fills, a routine gets a circle with the repeat
 * mark, because pressing it does not remove the row and a control that looks
 * like it will is a control that gets pressed once and never again.
 */
export function MyTasks({ tasks, today }: { tasks: ProducerTask[]; today: string }) {
  const ui = useCopy();
  const c = ui.myTasks;

  const open = tasks.filter((t) => !t.done);
  const finished = tasks.filter((t) => t.done);
  const waiting = open.filter((t) => t.due_on !== null && t.due_on <= today).length;

  return (
    <section className="card" aria-labelledby="my-tasks">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="my-tasks" className="font-display text-[22px] font-semibold text-ink">{c.title}</h2>
        {/* Only while it is not zero. A standing "0 להיום" is a number that
            trains people to stop reading the line it is on. */}
        {waiting > 0 && (
          <span className="text-[13px] font-semibold text-accent">{fill(c.waiting, { n: waiting })}</span>
        )}
      </div>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

      <AddForm />

      {open.length === 0 ? (
        <p className="mt-5 rounded-xl2 bg-surface-100 px-4 py-3 text-[14.5px] text-ink-mute">{c.empty}</p>
      ) : (
        <ul className="mt-5 list-none space-y-2 p-0">
          {open.map((t) => <Row key={t.id} task={t} today={today} />)}
        </ul>
      )}

      {/* The one-offs already done. Folded, because a finished task is a
          record rather than a thing to read, and untickable, because a tick
          by mistake should cost one press rather than being retyped. */}
      {finished.length > 0 && (
        <details className="mt-5">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[13.5px] text-ink-mute hover:text-ink [&::-webkit-details-marker]:hidden">
            <CheckCheck size={15} strokeWidth={1.5} aria-hidden />
            {c.doneOnes} · {finished.length}
          </summary>
          <ul className="mt-2 list-none space-y-2 p-0">
            {finished.map((t) => <Row key={t.id} task={t} today={today} />)}
          </ul>
        </details>
      )}
    </section>
  );
}

function SubmitButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap disabled:opacity-60" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/** The fields, written once and used by both the add form and the edit form —
 *  two copies of them is two places for the repeat list to drift.
 *
 *  The note is only on the edit form. Writing something down has to be three
 *  taps or it does not get written down at all, and a fourth box asking for
 *  context on "לרוקן את הרכב" is the tax that stops the list being used. It
 *  is one press away for the rows that earn one. */
function Fields({ task, withNote }: { task?: ProducerTask; withNote?: boolean }) {
  const ui = useCopy();
  const c = ui.myTasks;
  const repeats: [Repeat, string][] = [
    ['none', c.repeatNone], ['daily', c.repeatDaily],
    ['weekly', c.repeatWeekly], ['monthly', c.repeatMonthly],
  ];
  return (
    <>
      {/* The title takes the whole line and the two small fields share the
          next one. Four stacked boxes is what this looked like on a phone,
          and a form four boxes tall is a form somebody scrolls past. */}
      <input
        name="title" defaultValue={task?.title ?? ''} required minLength={2} maxLength={200}
        placeholder={c.titlePh} aria-label={c.titlePh}
        className="field w-full min-w-0 sm:w-auto sm:flex-1"
      />
      <input
        type="date" name="due_on" defaultValue={task?.due_on ?? ''}
        aria-label={c.due} className="field min-w-0 flex-1 basis-[8rem] sm:w-auto sm:flex-none sm:basis-auto"
      />
      <select
        name="repeat_every" defaultValue={task?.repeat_every ?? 'none'}
        aria-label={c.repeat} className="field min-w-0 flex-1 basis-[8rem] sm:w-auto sm:flex-none sm:basis-auto"
      >
        {repeats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {withNote && (
        <input
          name="note" defaultValue={task?.note ?? ''} maxLength={1000}
          placeholder={c.notesPh} aria-label={c.notesPh}
          className="field w-full"
        />
      )}
    </>
  );
}

function AddForm() {
  const ui = useCopy();
  const c = ui.myTasks;
  const [state, action] = useActionState<MyTaskResult | null, FormData>(addMyTask, null);
  return (
    <form action={action} className="mt-5 flex flex-wrap items-center gap-2">
      <Fields />
      <SubmitButton label={c.add} busy={c.adding} />
      {state?.error && <p className="w-full text-[13.5px] text-bad">{state.error}</p>}
    </form>
  );
}

function Row({ task, today }: { task: ProducerTask; today: string }) {
  const ui = useCopy();
  const c = ui.myTasks;
  const dateFmt = shortDate(ui.locale);
  const [editing, setEditing] = useState(false);
  /* The circle answers the press before the server does, the same reason the
     wedding tasks do it: a tick is a server action and a revalidation, which
     on a phone is long enough to look like nothing happened and be pressed
     again. */
  const [ticking, setTicking] = useState(false);

  const done = ticking ? !task.done : task.done;
  const where = done ? 'ahead' : standing(task.due_on, today);
  const repeatLabel: string =
    task.repeat_every === 'daily' ? c.repeatDaily
    : task.repeat_every === 'weekly' ? c.repeatWeekly
    : task.repeat_every === 'monthly' ? c.repeatMonthly
    : '';
  const routine = repeatLabel !== '';

  const tick = async () => {
    if (ticking) return;
    setTicking(true);
    try {
      const data = new FormData();
      data.append('task_id', task.id);
      await toggleMyTask(data);
    } finally {
      setTicking(false);
    }
  };

  return (
    <li className={`rounded-xl2 border px-3 py-3 ${
      where === 'late' ? 'border-bad/25 bg-bad-wash/60' : 'border-line'
    }`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={tick} disabled={ticking}
          aria-label={task.title} aria-pressed={done}
          className="-my-2 -mx-1 flex h-11 w-8 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-[13px] transition ${
              done ? 'border-ok/30 bg-ok text-surface' : 'border-line-strong bg-card hover:border-ink'
            }`}
          >
            {done ? '✓' : routine ? <RepeatIcon size={12} strokeWidth={1.75} className="text-ink-mute" /> : ''}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-[15px] ${done ? 'text-ink-mute line-through' : 'text-ink'}`}>{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-ink-mute">
            <span className={where === 'late' ? 'font-semibold text-bad' : where === 'today' ? 'font-semibold text-ink' : ''}>
              {where === 'today' ? c.today : formatDate(dateFmt, task.due_on, c.noDue)}
              {where === 'late' ? ` · ${c.overdue}` : ''}
            </span>
            {routine && <span>· {repeatLabel}</span>}
            {/* On a routine this is the only record that it ever happened. */}
            {task.done_on && <span>· {fill(c.lastDone, { date: formatDate(dateFmt, task.done_on, '') })}</span>}
          </p>
          {task.note && (
            <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-ink-soft">{task.note}</p>
          )}
        </div>

        {/* Their own line on a phone, beside the row on anything wider. In
            the same line the title wrapped onto two lines to make room for
            them, which is a row that reads as longer than it is. */}
        <div className="flex w-full items-center gap-2 ps-8 sm:w-auto sm:ps-0">
          <button
            type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}
            className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-[13px]"
          >
            <Pencil size={13} aria-hidden strokeWidth={1.5} />
            {c.edit}
          </button>
          <DeleteForm action={deleteMyTask}>
            <input type="hidden" name="task_id" value={task.id} />
            <button type="submit" className="btn-quiet px-3 py-1 text-[13px]">{c.remove}</button>
          </DeleteForm>
        </div>
      </div>

      {editing && <EditForm task={task} onDone={() => setEditing(false)} />}
    </li>
  );
}

function EditForm({ task, onDone }: { task: ProducerTask; onDone: () => void }) {
  const ui = useCopy();
  const c = ui.myTasks;
  const [state, action] = useActionState<MyTaskResult | null, FormData>(
    async (prev, form) => {
      const result = await updateMyTask(prev, form);
      if (result.ok) onDone();
      return result;
    },
    null,
  );
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <input type="hidden" name="task_id" value={task.id} />
      <Fields task={task} withNote />
      <SubmitButton label={c.save} busy={c.saving} />
      <button type="button" onClick={onDone} className="btn-quiet px-3 py-1 text-[13.5px]">{c.cancel}</button>
      {state?.error && <p className="w-full text-[13.5px] text-bad">{state.error}</p>}
    </form>
  );
}
