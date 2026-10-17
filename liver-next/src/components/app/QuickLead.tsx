'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus } from 'lucide-react';
import { Sheet } from '@/components/app/Sheet';
import { useCopy } from '@/components/app/CopyProvider';
import { quickLead, type LeadActionResult } from '@/app/actions/leads';

/**
 * Three fields, because the phone is still ringing.
 *
 * The full form asks eleven questions and is right for somebody at a desk
 * with an email open. This is for the other case, which is most of them: a
 * name, a number and a line about what was said, written while talking.
 * Saving opens the card, where the rest is filled in when there is time.
 */
function Save() {
  const c = useCopy().pipeline.quick;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

export function QuickLead({ sources }: { sources: { value: string; label: string }[] }) {
  const c = useCopy().pipeline.quick;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LeadActionResult | null, FormData>(quickLead, null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
        <Plus size={16} strokeWidth={1.5} aria-hidden />
        {c.button}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={c.title} sub={c.sub}>
        <form action={action} className="mt-5 space-y-4">
          <div>
            <label htmlFor="ql-name" className="block text-body font-medium text-ink">{c.name}</label>
            <input id="ql-name" name="full_name" required autoComplete="off" enterKeyHint="next" className="input mt-1" />
          </div>
          <div>
            <label htmlFor="ql-phone" className="block text-body font-medium text-ink">{c.phone}</label>
            <input id="ql-phone" name="phone" type="tel" inputMode="tel" required autoComplete="off" enterKeyHint="next" className="input mt-1" dir="ltr" />
          </div>
          <div>
            <label htmlFor="ql-note" className="block text-body font-medium text-ink">{c.note}</label>
            <textarea id="ql-note" name="note" rows={3} placeholder={c.notePh} enterKeyHint="done" className="input mt-1" />
          </div>
          <div>
            <label htmlFor="ql-source" className="block text-body font-medium text-ink">{c.source}</label>
            <select id="ql-source" name="source" className="field mt-1 w-full" defaultValue="phone">
              {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {state && !state.ok && <p role="alert" className="text-body text-bad">{state.error}</p>}
          <div className="flex justify-end"><Save /></div>
        </form>
      </Sheet>
    </>
  );
}
