'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { delaySchedule, liveNote, type ShowResult } from '@/app/actions/runOfShow';

/**
 * Two things the evening writes, on the producer's phone.
 *
 * The delay: everything from a time onward gets an actual time, the
 * plan stays what it was, and the sheet can say "twelve minutes behind"
 * without anybody rewriting forty lines at a quarter to ten. And a note
 * on a line, typed between two things happening, which is the summary
 * the morning after is written from.
 */
function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-quiet whitespace-nowrap" disabled={pending}>{pending ? busy : label}</button>;
}

export function LiveTools({ clientId, lines }: {
  clientId: string;
  lines: { id: string; title: string; at_time: string; note_live?: string | null; done_at?: string | null }[];
}) {
  const c = useCopy().intake;
  const [delayed, delay] = useActionState<ShowResult | null, FormData>(delaySchedule, null);
  const [noted, note] = useActionState<ShowResult | null, FormData>(liveNote, null);
  const open = lines.filter((l) => !l.done_at).slice(0, 3);

  return (
    <section className="card">
      <h2 className="head-sub">{c.rosDelayTitle}</h2>
      <form action={delay} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="client_id" value={clientId} />
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.rosDelayFrom}</span>
          <input name="from" className="field w-28" dir="ltr" placeholder="21:00" autoComplete="off" inputMode="numeric" required />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.rosDelayBy}</span>
          <input name="minutes" type="number" className="field w-24" dir="ltr" min={1} max={300} defaultValue={10} required />
        </label>
        <Busy label={c.rosDelayGo} busy={c.rosBuilding} />
        {delayed && <p role={delayed.ok ? 'status' : 'alert'} className={`w-full text-meta ${delayed.ok ? 'text-ok' : 'text-bad'}`}>{delayed.ok ? fill(c.rosDelayed, { n: delayed.added ?? 0 }) : delayed.error}</p>}
      </form>

      {open.length > 0 && (
        <ul className="mt-4 list-none space-y-3 p-0">
          {open.map((l) => (
            <li key={l.id}>
              <form action={note} className="flex items-end gap-2">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="item_id" value={l.id} />
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-meta text-ink-soft"><span dir="ltr">{l.at_time.slice(0, 5)}</span> · {l.title}</span>
                  <input name="note_live" className="field" defaultValue={l.note_live ?? ''} placeholder={c.rosNoteLive} autoComplete="off" />
                </label>
                <Busy label={c.rosNoteSave} busy={c.rosBuilding} />
              </form>
            </li>
          ))}
          {noted && !noted.ok && <li role="alert" className="text-meta text-bad">{noted.error}</li>}
        </ul>
      )}
    </section>
  );
}
