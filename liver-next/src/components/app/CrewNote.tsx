'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, NotebookPen } from 'lucide-react';
import { saveCrewNote } from '@/app/actions/crewMembers';
import type { CrewMemberResult } from '@/app/actions/crewMembers';
import { useCopy } from '@/components/app/CopyProvider';

function Save({ saved }: { saved: boolean }) {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <span className="inline-flex items-center gap-3">
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? c.saving : c.save}
      </button>
      {saved && !pending && (
        <span className="inline-flex items-center gap-1 text-[13px] text-good">
          <Check size={14} aria-hidden strokeWidth={1.5} />{c.crewNoteSaved}
        </span>
      )}
    </span>
  );
}

/**
 * What the producer wants everybody working this evening to know.
 *
 * A field of its own rather than a corner of the brief, and that is a
 * security decision rather than a tidiness one: the brief is his own working
 * note about the couple and has money and opinions in it, and pointing the
 * crew screen at it would have published nine months of private notes the
 * first time somebody was assigned. This one is written to be read.
 */
export function CrewNote({ clientId, note }: { clientId: string; note: string }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(saveCrewNote, null);

  return (
    <section aria-labelledby="crew-note" className="card p-4 sm:p-5">
      <h3 id="crew-note" className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
        <NotebookPen size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
        {c.crewNoteTitle}
      </h3>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.crewNoteSub}</p>

      <form action={action} className="mt-3">
        <input type="hidden" name="client_id" value={clientId} />
        <label className="sr-only" htmlFor="crew-note-text">{c.crewNoteTitle}</label>
        <textarea
          id="crew-note-text" name="crew_note" rows={3} defaultValue={note}
          placeholder={c.crewNotePh} className="field"
        />
        {state?.error && (
          <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {state.error}
          </p>
        )}
        <div className="mt-3"><Save saved={!!state?.ok} /></div>
      </form>
    </section>
  );
}
