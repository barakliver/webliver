'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toggleTask } from '@/app/actions/tasks';
import { useCopy } from '@/components/app/CopyProvider';

/**
 * Ticking a task off from wherever it is being read.
 *
 * The pile on the overview is a list of things waiting for a decision, and
 * about half of them are his own tasks. Until now the only way to finish one
 * was to open the event, find it in the list, and tick it there — three
 * screens to record something that took four seconds to actually do, which is
 * how a list of nine things stays a list of nine things all week.
 *
 * The circle answers the press before the server does, for the same reason it
 * does on the couple's screen: a tick is a server action and three
 * revalidations, and a control that looks unchanged for a second gets pressed
 * twice — and the second press undoes the first.
 *
 * `toggleTask` and nothing else, deliberately: it is the one place a task is
 * ticked, and the check suite asserts that. Ticking a supplier task through
 * it also takes back the supplier the tick created, which a write from here
 * straight to the row would have quietly skipped.
 */
export function TaskTick({ taskId, clientId, label }: {
  taskId: string; clientId: string;
  /** The task's own title, so a screen reader hears what is being ticked. */
  label: string;
}) {
  const c = useCopy().overview2;
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const tick = async () => {
    if (busy || done) return;
    setBusy(true);
    setDone(true);
    try {
      const data = new FormData();
      data.append('task_id', taskId);
      data.append('client_id', clientId);
      /* What it is now. The action writes the opposite, and everything that
         reaches this button is a task that is still open. */
      data.append('done', 'false');
      await toggleTask(data);
    } catch {
      /* The row stays on the screen and the circle goes back to empty, which
         is the truth: nothing was written. */
      setDone(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={tick}
      disabled={busy || done}
      aria-label={`${c.markDone}: ${label}`}
      title={c.markDone}
      className="relative z-10 -my-2 flex h-11 w-10 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
          done ? 'border-ok/30 bg-ok text-surface' : 'border-line-strong bg-card text-ink-mute hover:border-ink hover:text-ink'
        }`}
      >
        <Check size={15} strokeWidth={2} />
      </span>
    </button>
  );
}
