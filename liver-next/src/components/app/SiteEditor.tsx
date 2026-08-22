'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, RotateCcw } from 'lucide-react';
import { saveSiteCopy, type CopyResult } from '@/app/actions/siteCopy';
import { EDITABLE, type EditableField } from '@/content/editable';
import { siteEditorCopy as c } from '@/content/site';

function Save({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary px-5 text-[14px]" disabled={pending || !dirty}>
      {pending ? c.saving : c.save}
    </button>
  );
}

/**
 * One sentence, with the shipped wording underneath it.
 *
 * Each field is its own form. A single save button over forty fields means one
 * mistake anywhere blocks every other change, and means the screen has to
 * decide what to do when three of them fail and thirty-seven succeed. One
 * field, one save, one answer.
 *
 * The default is shown rather than described, because "restore the original"
 * is a promise nobody can evaluate without seeing what the original says.
 */
function Field({ field, current, isOverridden }: {
  field: EditableField; current: string; isOverridden: boolean;
}) {
  const [value, setValue] = useState(current);
  const [state, action] = useActionState<CopyResult | null, FormData>(saveSiteCopy, null);

  const dirty = value !== current;
  const saved = state?.ok && !dirty;

  return (
    <form action={action} className="rounded-2xl border border-line p-4">
      <input type="hidden" name="key" value={field.key} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="label mb-0" htmlFor={`f-${field.key}`}>{field.label}</label>
        {isOverridden && <span className="text-[12px] text-accent">{c.edited}</span>}
      </div>

      {field.kind === 'paragraphs' ? (
        <textarea
          id={`f-${field.key}`}
          name="value"
          rows={Math.min(10, Math.max(3, value.split('\n').length + 1))}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field mt-1.5 resize-y leading-relaxed"
        />
      ) : (
        <input
          id={`f-${field.key}`}
          name="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field mt-1.5"
        />
      )}

      {field.hint && <p className="mt-1.5 text-[12.5px] text-ink-mute">{field.hint}</p>}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-2xl border border-bad/25 bg-bad-wash px-4 py-2.5 text-[13.5px] text-bad">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Save dirty={dirty} />
        {isOverridden && (
          <button
            type="submit"
            /* Submitting an empty value is what a reset is, all the way down to
               the database, so this is the same form rather than a second path
               that could disagree with it. */
            onClick={() => setValue('')}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-mute transition hover:text-accent"
          >
            <RotateCcw size={14} aria-hidden strokeWidth={1.75} />
            {c.reset}
          </button>
        )}
        {saved && (
          <span role="status" className="inline-flex items-center gap-1.5 text-[13px] text-ok">
            <Check size={14} aria-hidden strokeWidth={2} />
            {state?.reset ? c.wasReset : c.saved}
          </span>
        )}
        {dirty && <span className="text-[12.5px] text-ink-mute">{c.unsaved}</span>}
      </div>
    </form>
  );
}

/**
 * The words on the public site, editable by the person whose business it is.
 *
 * Everything offered here is rendered by something. Nothing rendered by a part
 * of the site that has not been wired up is offered, because a field that saves
 * and changes nothing is worse than a field that is not there.
 */
export function SiteEditor({ values, overridden }: {
  values: Record<string, string>;
  overridden: Set<string>;
}) {
  const [open, setOpen] = useState<string>(EDITABLE[0].id);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label={c.sections} className="flex flex-wrap gap-1.5 lg:flex-col">
        {EDITABLE.map((g) => {
          const count = g.fields.filter((f) => overridden.has(f.key)).length;
          const on = g.id === open;
          return (
            <button
              key={g.id}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => setOpen(g.id)}
              className={`inline-flex min-h-[38px] items-center justify-between gap-2 rounded-full px-4 text-right text-[14px] transition lg:w-full ${
                on ? 'bg-ink font-medium text-surface' : 'text-ink-soft hover:bg-surface-200 hover:text-ink'
              }`}
            >
              {g.title}
              {count > 0 && (
                <span className={`rounded-full px-1.5 text-[11.5px] tabular-nums ${
                  on ? 'bg-card/20 text-surface' : 'bg-accent-wash text-accent'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div>
        {EDITABLE.filter((g) => g.id === open).map((g) => (
          <section key={g.id}>
            <h2 className="font-display text-[19px] font-semibold text-ink">{g.title}</h2>
            <p className="mt-1 text-[14px] text-ink-soft">{g.sub}</p>
            <div className="mt-5 space-y-3">
              {g.fields.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  current={values[f.key] ?? ''}
                  isOverridden={overridden.has(f.key)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
