'use client';

import { Check, TriangleAlert, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { assignCrew } from '@/app/actions/crewMembers';
import { crewState, candidatesFor, type CrewSlot } from '@/lib/crewNeeds';
import { useCopy } from '@/components/app/CopyProvider';
import { Ltr } from '@/components/Ltr';
import type { CrewPerson } from '@/components/app/CrewDesk';

export type AssignedCrew = {
  id: string; name: string; slot: string | null;
  /** Set when this row came out of the directory. It is how the picker knows
   *  not to offer somebody who is already on the evening — by identity rather
   *  than by matching the name, which two people can share. */
  crew_member_id: string | null;
};

function Assign() {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost shrink-0 text-[13.5px]" disabled={pending}>
      {pending ? c.saving : c.assign}
    </button>
  );
}

/**
 * The staffing rule, on the evening it is about.
 *
 * It has been an iron rule for years and it lived in one head: up to 350
 * guests a manager and an assistant, above 350 a manager and two, and social
 * on offer at every evening. A rule in a head is a rule that is right until
 * the week somebody is booking four evenings at once.
 *
 * So the screen says what this evening takes, who is in each role, and what is
 * missing — and the only two presses are choosing a person and assigning them.
 * Nobody is hidden from the picker: the list of who does what is a description
 * of the usual, and two days out "usual" stops being the question, so people
 * who do the job are sorted first and everybody else is still there under them.
 */
export function CrewNeeds({
  clientId, guests, assigned, people,
}: {
  clientId: string;
  /** The number the rule is applied to, or null when nobody has written one. */
  guests: number | null;
  assigned: AssignedCrew[];
  people: CrewPerson[];
}) {
  const c = useCopy().crew;
  const labels: Record<CrewSlot, string> = {
    manager: c.slotManager, assistant: c.slotAssistant, social: c.slotSocial,
  };

  const { slots, short, certain } = crewState(guests, assigned);
  const on = new Set(assigned.map((a) => a.crew_member_id).filter(Boolean));
  const free = people.filter((p) => !p.archived_at && !on.has(p.id));

  return (
    <section aria-labelledby="crew-needs" className="card p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="crew-needs" className="font-display text-[17px] font-semibold text-ink">{c.ruleTitle}</h3>
        <p className="text-[13px] text-ink-mute">
          {certain
            ? <>{c.ruleBy}: <Ltr>{String(guests)}</Ltr></>
            : c.ruleUnsure}
        </p>
      </header>

      <ul className="mt-4 list-none space-y-3 p-0">
        {slots.map((s) => {
          const inRole = assigned.filter((a) => a.slot === s.slot);
          return (
            <li key={s.slot} className="rounded-xl2 border border-line-soft bg-surface-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-[15px] text-ink">{labels[s.slot]}</span>
                {s.short > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-bad">
                    <TriangleAlert size={14} aria-hidden strokeWidth={1.5} />
                    {c.ruleShort}: <Ltr>{String(s.short)}</Ltr>
                  </span>
                ) : s.optional && s.filled === 0 ? (
                  <span className="text-[13px] text-ink-mute">{c.ruleOptional}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-good">
                    <Check size={14} aria-hidden strokeWidth={1.5} />
                    {c.ruleFilled}
                  </span>
                )}
              </div>

              {inRole.length > 0 && (
                <p className="mt-1.5 text-[13.5px] text-ink-soft">
                  {inRole.map((a) => a.name).join(' · ')}
                </p>
              )}

              {/* One press, from the directory, straight into this role. */}
              {free.length > 0 ? (
                <form action={assignCrew} className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="slot" value={s.slot} />
                  <label className="sr-only" htmlFor={`assign-${s.slot}`}>
                    {c.assignTo}: {labels[s.slot]}
                  </label>
                  <select
                    id={`assign-${s.slot}`} name="member_id" required
                    className="field w-auto min-w-0 max-w-[17rem] flex-1 basis-40 text-[14px]"
                    defaultValue=""
                  >
                    <option value="" disabled>{c.fromDirectory}</option>
                    {candidatesFor(free, s.slot).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Assign />
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {short === 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-good">
          <Check size={15} aria-hidden strokeWidth={1.5} />
          {c.ruleDone}
        </p>
      )}

      {people.length === 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-mute">
          <UserPlus size={15} aria-hidden strokeWidth={1.5} />
          {c.noDirectory}
          <Link href="/app/crew" className="text-accent underline underline-offset-4">
            {c.toDirectory}
          </Link>
        </p>
      )}
    </section>
  );
}
