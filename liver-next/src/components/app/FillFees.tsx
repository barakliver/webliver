'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Wallet } from 'lucide-react';
import { fillCrewFees, type CrewMemberResult } from '@/app/actions/crewMembers';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { Ltr } from '@/components/Ltr';

function Go() {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost inline-flex items-center gap-2 text-[13.5px]" disabled={pending}>
      <Wallet size={15} aria-hidden strokeWidth={1.5} />
      {pending ? c.saving : c.fillFees}
    </button>
  );
}

/**
 * The rates, applied to the assignments that were made before them.
 *
 * `assign_crew` copies a rate onto an assignment at the moment of assigning,
 * and that is right: raising a rate next March must not rewrite what last
 * August cost. What it missed is the order a season actually happens in. The
 * crew gets built and staffed across nine events first, and the money is
 * typed afterwards — so every one of those assignments carries nothing, the
 * board adds them to zero, and an evening with three people on it reads as
 * free.
 *
 * Taking each person off and putting them back on, nine times, was the only
 * way out. This is the other way out, and it fills blanks only: a fee that is
 * written down was agreed for that evening, and replacing it with a list
 * price would quietly undo the negotiation the copy exists to protect.
 */
export function FillFees({ missing }: { missing: number }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<
    (CrewMemberResult & { filled?: number }) | null, FormData
  >(fillCrewFees, null);

  if (missing === 0 && !state?.ok) {
    return <p className="text-[13px] text-ink-mute">{c.fillFeesNone}</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Go />
      {state?.ok ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-good">
          <Check size={14} aria-hidden strokeWidth={1.5} />
          {fill(c.fillFeesDone, { n: String(state.filled ?? 0) })}
        </span>
      ) : state?.error ? (
        <span className="text-[13px] text-bad">{state.error}</span>
      ) : (
        <span className="text-[13px] text-ink-mute">
          <Ltr>{String(missing)}</Ltr> · {c.fillFeesHint}
        </span>
      )}
    </form>
  );
}
