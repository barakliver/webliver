'use client';

import { useState } from 'react';
import { toggleTask } from '@/app/actions/tasks';
import { VendorCaptureModal } from '@/components/portal/VendorCaptureModal';
import { pressOnCircle } from '@/content/eventFile';

/** What a press needs to know about the row it is pressing. */
export type PressableTask = {
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

/**
 * Pressing a task, wherever it is drawn.
 *
 * Two screens now tick the same rows — the checklist and the bingo board —
 * and what a press means is four separate decisions that have to agree on
 * both: that a supplier task opens the form instead of going straight to a
 * tick; that the answer shows immediately and the server catches up; that
 * both ways out of that form mean the same thing; and that the write itself
 * goes through `toggleTask` and nowhere else, because that is the one that
 * revalidates all three screens and takes the supplier back off an untick.
 *
 * All four lived inside one row component. A second caller would have had to
 * copy them, and a copy of "what a press means" is the kind that agrees on
 * the day it is written and stops agreeing the first time one side is fixed.
 *
 * Not to be confused with `TaskTick` next door, which is the one-press circle
 * on the producer's own attention pile: that one only ever finishes a task
 * and never asks about a supplier, because the pile is the producer's own
 * errands rather than the couple's decisions.
 */
export function useTaskPress(task: PressableTask, clientId: string) {
  /* The circle answers the press before the server does. A tick is a server
     action, a revalidation of three paths and a re-render, which on a phone
     in a hall is a second or more of a control that looks exactly as it did —
     so it gets pressed again, and the second press unticks what the first one
     ticked. Shown ticked while the call is in flight, and the real answer
     replaces it when it lands. */
  const [ticking, setTicking] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const tick = async () => {
    if (ticking) return;
    setTicking(true);
    try {
      const form = new FormData();
      form.append('task_id', task.id);
      form.append('client_id', clientId);
      form.append('done', String(task.done));
      await toggleTask(form);
    } finally {
      setTicking(false);
    }
  };

  /* Decided beside the list of supplier categories it reads, rather than
     wherever the press happens to land. */
  const press = async () => {
    if (pressOnCircle(task) === 'capture') setCapturing(true);
    else await tick();
  };

  /* Rendered by the caller wherever it likes: the form is a fixed overlay, so
     where in the tree it sits changes nothing about where it appears. */
  const captureForm = capturing && task.category ? (
    <VendorCaptureModal
      task={{
        id: task.id,
        client_id: clientId,
        event_id: task.event_id ?? null,
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
      onClose={() => setCapturing(false)}
      /* Both ways out of the form that mean "it is done" tick the same way.
         The form's own job ends at the supplier. */
      onSaved={async () => { setCapturing(false); await tick(); }}
      onSkip={async () => { setCapturing(false); await tick(); }}
    />
  ) : null;

  return { done: ticking ? !task.done : task.done, ticking, press, captureForm };
}
