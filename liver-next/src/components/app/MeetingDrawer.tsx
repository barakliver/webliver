'use client';

import { useState, useTransition } from 'react';
import { CalendarDays, ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import { saveMeeting, deleteMeeting } from '@/app/actions/meetings';
import { MEETING_TEMPLATES, meetingTemplate, type Field, type MeetingTemplate } from '@/content/meetings';
import { completeness } from '@/lib/ai/meeting';
import { meetingCopy as c } from '@/content/site';
import { Ltr } from '@/components/Ltr';

export type MeetingLog = {
  id: string;
  kind: string;
  title: string;
  held_on: string | null;
  answers: Record<string, unknown>;
  summary: string;
  summary_by: 'none' | 'model' | 'person';
  visible_to_client: boolean;
  updated_at: string;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The four meetings, as a form that matches the conversation.
 *
 * The questions are in the order they come up in the room, which is the whole
 * reason this is worth building: a form that asks in a different order gets
 * filled in afterwards from memory, and a summary written from memory is worth
 * less than no summary.
 *
 * Nothing here is required. A producer who filled in three fields standing in
 * a car park has recorded three true things, and a form that refuses to save
 * until it is complete is a form that gets abandoned at the door and written
 * up never.
 */
export function MeetingDrawer({ clientId, logs }: { clientId: string; logs: MeetingLog[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-[13.5px] text-ink-mute">{c.sub}</p>
        </div>
      </div>

      {/* Four buttons rather than a menu. There are exactly four and they are
          the whole feature; hiding them behind a select would be hiding the
          thing the screen is for. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {MEETING_TEMPLATES.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => { setAdding(adding === t.kind ? null : t.kind); setEditing(null); }}
            aria-pressed={adding === t.kind}
            className={`rounded-button border px-4 py-2 text-start text-[13.5px] transition ${
              adding === t.kind
                ? 'border-accent bg-accent-wash text-ink'
                : 'border-line-strong bg-card text-ink-soft hover:border-accent/40 hover:text-ink'
            }`}
          >
            <span className="block text-ink">{t.title}</span>
            <span className="block text-[12px] text-ink-mute">{t.when}</span>
          </button>
        ))}
      </div>

      {adding && (
        <div className="mt-5">
          <Form
            clientId={clientId}
            template={meetingTemplate(adding)!}
            onDone={() => setAdding(null)}
          />
        </div>
      )}

      {logs.length === 0 && !adding ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {logs.map((log) => {
            const t = meetingTemplate(log.kind);
            const on = editing === log.id;
            return (
              <li key={log.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditing(on ? null : log.id); setAdding(null); }}
                    aria-expanded={on}
                    className="min-w-0 flex-1 text-start"
                  >
                    <p className="text-[15px] text-ink">{log.title || t?.title || c.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-mute">
                      {log.held_on && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={13} aria-hidden strokeWidth={1.5} />
                          {dateFmt.format(new Date(log.held_on))}
                        </span>
                      )}
                      {t && <span>{answered(t, log.answers)}</span>}
                      {log.visible_to_client && <span className="text-accent">{c.shareWithCouple}</span>}
                    </p>
                  </button>

                  <span className="flex shrink-0 items-center gap-1">
                    <ChevronDown
                      size={16} aria-hidden strokeWidth={1.5}
                      className={`text-ink-mute transition-transform ${on ? 'rotate-180' : ''}`}
                    />
                    <form action={deleteMeeting} onSubmit={(e) => { if (!confirm(c.removeAsk)) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={log.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <button
                        type="submit"
                        className="btn-quiet grid size-11 place-items-center p-0 sm:size-8"
                        aria-label={c.remove}
                      >
                        <Trash2 size={14} aria-hidden strokeWidth={1.5} />
                      </button>
                    </form>
                  </span>
                </div>

                {!on && log.summary && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-[13.5px] text-ink-soft">
                    {log.summary}
                  </p>
                )}

                {on && t && (
                  <div className="mt-3">
                    <Form clientId={clientId} template={t} log={log} onDone={() => setEditing(null)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const answered = (t: MeetingTemplate, answers: Record<string, unknown>) => {
  const { filled, total } = completeness(t, answers);
  return c.answered(filled, total);
};

function Form({ clientId, template, log, onDone }: {
  clientId: string; template: MeetingTemplate; log?: MeetingLog; onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(log?.answers ?? {});
  const [heldOn, setHeldOn] = useState(log?.held_on ?? '');
  const [shared, setShared] = useState(log?.visible_to_client ?? false);
  const [summary, setSummary] = useState(log?.summary ?? '');
  const [by, setBy] = useState(log?.summary_by ?? 'none');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'save' | 'model' | null>(null);
  const [, start] = useTransition();

  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));

  const submit = async (withModel: boolean) => {
    setBusy(withModel ? 'model' : 'save');
    setError('');
    const res = await saveMeeting({
      id: log?.id,
      clientId,
      kind: template.kind,
      title: template.title,
      heldOn: heldOn || undefined,
      answers,
      visibleToClient: shared,
      withModel,
    });
    setBusy(null);
    if (!res.ok) { setError(res.error ?? c.saveFailed); return; }
    setSummary(res.summary ?? '');
    setBy(withModel && res.summary ? 'model' : 'person');
    if (!withModel) start(() => onDone());
  };

  const { filled, total } = completeness(template, answers);

  return (
    <div className="rounded-card-sm bg-surface-100 p-4">
      <p className="text-[13.5px] text-ink-soft">{template.blurb}</p>

      <label className="mt-4 block text-[12.5px] text-ink-mute">
        {c.held}
        <input
          type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)}
          className="field mt-1 w-full sm:w-[200px]"
        />
      </label>

      {template.sections.map((section) => (
        <fieldset key={section.title} className="mt-5 border-0 p-0">
          <legend className="text-[13px] text-accent">{section.title}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {section.fields.map((f) => (
              <Input key={f.id} field={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} />
            ))}
          </div>
        </fieldset>
      ))}

      <label className="mt-5 flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14px] text-ink-soft">
        <input
          type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)}
          className="size-5 rounded border-line-strong accent-accent"
        />
        {c.shareWithCouple}
      </label>
      <p className="text-[12.5px] text-ink-mute">{c.shareHint}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-ink-mute">{c.answered(filled, total)}</span>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={onDone} className="btn-quiet px-3 text-[14px]">{c.cancel}</button>
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={busy !== null || filled === 0}
            className="btn-quiet inline-flex items-center gap-1.5 px-3 text-[14px] disabled:opacity-50"
          >
            <Sparkles size={15} aria-hidden strokeWidth={1.5} />
            {busy === 'model' ? c.summarising : c.summarise}
          </button>
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={busy !== null}
            className="btn-primary disabled:opacity-60"
          >
            {busy === 'save' ? c.saving : c.save}
          </button>
        </span>
      </div>

      {summary ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[11.5px] tracking-[.14em] text-ink-mute">{c.summary}</p>
          <p className="mt-2 whitespace-pre-line text-[14px] text-ink">{summary}</p>
          {by === 'model' && (
            <p className="mt-2 text-[12.5px] text-ink-mute">{c.summaryByModel}</p>
          )}
        </div>
      ) : (
        <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-mute">{c.summaryNone}</p>
      )}
    </div>
  );
}

function Input({ field, value, onChange }: {
  field: Field; value: unknown; onChange: (v: unknown) => void;
}) {
  const id = `mf-${field.id}`;
  const common = 'field w-full';
  const label = (
    <label htmlFor={id} className="block text-[12.5px] text-ink-mute">
      {field.label}
    </label>
  );

  if (field.kind === 'long') {
    return (
      <div className="sm:col-span-2">
        {label}
        <textarea
          id={id} rows={3} className={`${common} mt-1 resize-y`}
          value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}
          placeholder={field.hint}
        />
      </div>
    );
  }

  if (field.kind === 'yesno') {
    return (
      <div>
        {label}
        <div className="mt-1 flex gap-2">
          {[['כן', true], ['לא', false]].map(([text, v]) => (
            <button
              key={String(v)} type="button"
              onClick={() => onChange(value === v ? undefined : v)}
              aria-pressed={value === v}
              className={`min-h-[44px] flex-1 rounded-control border text-[14px] transition sm:min-h-[38px] ${
                value === v
                  ? 'border-accent bg-accent-wash text-ink'
                  : 'border-line-strong bg-card text-ink-soft hover:text-ink'
              }`}
            >
              {text as string}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === 'choice') {
    return (
      <div>
        {label}
        <select
          id={id} className={`${common} mt-1`}
          value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}
        >
          <option value="">·</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        id={id}
        type={field.kind === 'number' ? 'number' : field.kind === 'time' ? 'time' : 'text'}
        inputMode={field.kind === 'number' ? 'numeric' : undefined}
        className={`${common} mt-1`}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.kind === 'number' ? e.target.value : e.target.value)}
        placeholder={field.hint}
        autoComplete="off"
      />
    </div>
  );
}
