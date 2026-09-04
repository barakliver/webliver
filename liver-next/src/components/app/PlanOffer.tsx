'use client';

import { useState, useTransition } from 'react';
import { ListChecks } from 'lucide-react';
import { startFirstPlan } from '@/app/actions/workflow';
import { useCopy } from '@/components/app/CopyProvider';

/**
 * What an empty task list should say to somebody who has never used this.
 *
 * "No tasks yet" is true and is the wrong thing to put on the screen of a
 * producer who has just opened their first event. They know there are no
 * tasks; what they came for is to find out what there should be. The
 * operating book tells them to load a schedule from a template, and until
 * this existed there were no templates to load, so the sentence was an
 * accurate description of a dead end.
 *
 * Only where there is nothing. Once a list has anything on it at all, this
 * disappears — a producer with their own way of working should not be offered
 * somebody else's twenty-eight steps on every visit.
 */
export function PlanOffer({ clientId }: { clientId: string }) {
  const c = useCopy().tasks;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; added?: number; error?: string } | null>(null);

  if (result?.ok) {
    return (
      <p role="status" className="mt-6 text-[14.5px] text-ink-soft">
        {/* Nothing added is a real outcome rather than a failure: it means
            every step was already on the event, which is worth saying plainly
            instead of reporting success over a list that did not change. */}
        {result.added ? `${c.planDone} · ${result.added}` : c.planEmpty}
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-xl2 border border-line bg-surface-100 p-5">
      <p className="text-[14.5px] text-ink-mute">{c.none}</p>

      <div className="mt-4 flex items-baseline gap-3">
        <ListChecks size={18} strokeWidth={1.5} aria-hidden className="shrink-0 translate-y-0.5 text-accent" />
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink">{c.planTitle}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{c.planBody}</p>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary mt-4"
        disabled={pending}
        onClick={() => start(async () => setResult(await startFirstPlan(clientId)))}
      >
        {pending ? c.planBusy : c.planCta}
      </button>

      {result && !result.ok && result.error && (
        <p role="alert" className="mt-3 text-[14px] text-bad">{result.error}</p>
      )}
    </div>
  );
}
