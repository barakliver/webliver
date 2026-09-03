'use client';

import { useState, useTransition } from 'react';
import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { saveTemplate, deleteTemplate, seedMeetingTemplate } from '@/app/actions/workflow';
import { workflowCopy as c } from '@/content/site';

export type Step = { title: string; offset_days: number; owner: 'producer' | 'client'; note?: string };
export type Template = {
  id: string; name: string; kind: string; steps: Step[]; created_at: string;
};

/**
 * The lists a producer works to, on the page where the playbook already lives.
 *
 * A step is stored as a number of days from the wedding, and shown as a number
 * of days *before* it — because that is how anybody says it out loud. "Ninety
 * days before" is a sentence; "minus ninety" is a database column. The sign
 * flips at the edge of this component and nowhere else.
 *
 * There is no drag here on purpose. Order does not matter: applying a template
 * dates every step from the wedding, so the timeline sorts itself and a step's
 * position in this list decides nothing. A handle that changed nothing would
 * be a lie about what the list is.
 */
export function WorkflowTemplates({ templates }: { templates: Template[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, startSeed] = useTransition();

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-[13.5px] text-ink-mute">{c.sub}</p>
        </div>
        {!adding && (
          <div className="flex flex-wrap gap-2">
            {templates.length === 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => startSeed(() => { void seedMeetingTemplate(); })}
                className="btn-quiet px-3 text-[14px] disabled:opacity-60"
              >
                {c.seed}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setAdding(true); setEditing(null); }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} aria-hidden strokeWidth={1.5} />
              {c.add}
            </button>
          </div>
        )}
      </div>

      {adding && (
        <div className="mt-5">
          <Editor onDone={() => setAdding(false)} />
        </div>
      )}

      {templates.length === 0 && !adding ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {templates.map((t) => {
            const on = editing === t.id;
            return (
              <li key={t.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditing(on ? null : t.id); setAdding(false); }}
                    aria-expanded={on}
                    className="min-w-0 flex-1 text-start"
                  >
                    <p className="text-[15px] text-ink">{t.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-mute">
                      {c.stepsCount(t.steps.length)}
                    </p>
                  </button>

                  <form
                    action={deleteTemplate}
                    onSubmit={(e) => { if (!confirm(c.removeAsk)) e.preventDefault(); }}
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="btn-quiet px-2 py-1" aria-label={`${c.remove} ${t.name}`}>
                      <Trash2 size={14} aria-hidden strokeWidth={1.5} />
                    </button>
                  </form>
                </div>

                {on && <div className="mt-3"><Editor template={t} onDone={() => setEditing(null)} /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const blank = (): Step => ({ title: '', offset_days: -30, owner: 'producer' });

function Editor({ template, onDone }: { template?: Template; onDone: () => void }) {
  const [name, setName] = useState(template?.name ?? '');
  const [steps, setSteps] = useState<Step[]>(
    template?.steps?.length ? template.steps : [blank()]
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (i: number, patch: Partial<Step>) =>
    setSteps((all) => all.map((s, n) => (n === i ? { ...s, ...patch } : s)));

  const submit = async () => {
    setSaving(true);
    setError('');
    const res = await saveTemplate({ id: template?.id, name, kind: template?.kind, steps });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? c.saveFailed); return; }
    onDone();
  };

  return (
    <div className="rounded-card-sm bg-surface-100 p-4">
      <label className="block text-[12.5px] text-ink-mute">
        {c.name}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={c.namePh}
          className="field mt-1 w-full"
          autoComplete="off"
        />
      </label>

      <p className="mt-5 text-[13px] text-accent">{c.steps}</p>
      <ul className="mt-2 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="grid gap-2 rounded-control border border-line bg-card p-3 sm:grid-cols-[auto_1fr_120px_130px_auto] sm:items-center">
            <span className="hidden text-ink-mute sm:block" aria-hidden>
              <GripVertical size={15} strokeWidth={1.5} />
            </span>

            <input
              value={s.title}
              onChange={(e) => set(i, { title: e.target.value })}
              maxLength={200}
              placeholder={c.stepTitle}
              aria-label={c.stepTitle}
              className="field"
              autoComplete="off"
            />

            <label className="block text-[12px] text-ink-mute">
              {c.stepWhen}
              <input
                type="number"
                min={0}
                max={1825}
                /* Shown as days *before*, stored as a negative offset. */
                value={Math.abs(s.offset_days)}
                onChange={(e) => set(i, { offset_days: -Math.abs(Number(e.target.value) || 0) })}
                aria-label={c.stepWhen}
                className="field mt-0.5 w-full"
              />
            </label>

            <label className="block text-[12px] text-ink-mute">
              {c.stepOwner}
              <select
                value={s.owner}
                onChange={(e) => set(i, { owner: e.target.value === 'client' ? 'client' : 'producer' })}
                aria-label={c.stepOwner}
                className="field mt-0.5 w-full"
              >
                <option value="producer">{c.ownerProducer}</option>
                <option value="client">{c.ownerClient}</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setSteps((all) => (all.length > 1 ? all.filter((_, n) => n !== i) : all))}
              className="btn-quiet justify-self-start px-2 py-1"
              aria-label={c.removeStep}
            >
              <X size={15} aria-hidden strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setSteps((all) => [...all, blank()])}
        className="btn-quiet mt-2 inline-flex items-center gap-1.5 px-3 text-[13.5px]"
      >
        <Plus size={14} aria-hidden strokeWidth={1.5} />
        {c.addStep}
      </button>

      <p className="mt-2 text-[12.5px] text-ink-mute">{c.stepWhenHint}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button type="button" onClick={onDone} className="btn-quiet px-3 text-[14px]">{c.cancel}</button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="btn-primary disabled:opacity-60"
        >
          {saving ? c.saving : c.save}
        </button>
      </div>
    </div>
  );
}
