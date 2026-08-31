'use client';

import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { applyTemplate } from '@/app/actions/workflow';
import { workflowCopy as c } from '@/content/site';
import type { Template } from '@/components/app/WorkflowTemplates';
import { Ltr } from '@/components/Ltr';

/**
 * Putting one of the producer's own lists onto this event.
 *
 * Renders nothing when they have not built one. An empty select above a
 * disabled button is a screen explaining a feature nobody has set up, and the
 * place to set it up is somewhere else — the playbook page says so there.
 *
 * Applying twice fills in what is missing rather than refusing, so the button
 * stays pressable and its answer is a count. "Everything was already there" is
 * a useful thing to be told; a greyed out control is not.
 */
export function ApplyTemplate({ clientId, templates, hasDate }: {
  clientId: string; templates: Template[]; hasDate: boolean;
}) {
  const [pick, setPick] = useState(templates[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [error, setError] = useState('');

  if (templates.length === 0) return null;

  const go = async () => {
    setBusy(true);
    setSaid('');
    setError('');
    const res = await applyTemplate(clientId, pick);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? c.saveFailed); return; }
    setSaid(c.applied(res.added ?? 0));
  };

  return (
    <section className="card">
      <div className="flex items-center gap-2 text-accent">
        <ListChecks size={16} strokeWidth={1.5} aria-hidden />
        <h2 className="eyebrow">{c.onThisEvent}</h2>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-[12.5px] text-ink-mute">
          {c.which}
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="field mt-1 w-full"
            aria-label={c.which}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {c.stepsCount(t.steps.length)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void go()}
          disabled={busy || !pick}
          className="btn-primary disabled:opacity-60"
        >
          {busy ? c.applying : c.apply}
        </button>
      </div>

      {/* Said before the press, not after: an event with no date still gets the
          checklist, and somebody should know that is what they are about to
          get rather than wonder why nothing has a deadline. */}
      {!hasDate && <p className="mt-3 text-[13px] text-warn">{c.noDate}</p>}

      {said && (
        <p role="status" className="mt-3 inline-block rounded-control border border-ok/30 bg-ok-wash px-4 py-2 text-[14px] text-ok">
          <Ltr>{said}</Ltr>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {error}
        </p>
      )}
    </section>
  );
}
