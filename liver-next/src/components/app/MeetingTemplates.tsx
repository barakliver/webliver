'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import {
  saveMeetingTemplate, removeMeetingTemplate, copyBuiltInTemplate,
} from '@/app/actions/meetingTemplates';
import { BUILT_IN_TEMPLATES, FIELD_KINDS, type FieldKind, type MeetingTemplate } from '@/content/meetings';
import { questionCount } from '@/lib/meetingTemplates';
import type { MeetingTemplatesCopy } from '@/content/appUi';

/**
 * The producer's own meeting forms, built here and offered on every event.
 *
 * Two lists. The standing meetings are compiled in and cannot be edited, but
 * any of them can be copied into the second list, which is the producer's and
 * can be anything. The first call is the one the copy button exists for: a
 * producer who runs it differently starts from ours and changes three
 * questions, rather than starting from nothing.
 *
 * Order matters in this editor, unlike the workflow one, and the arrows say
 * so. A form that asks in a different order from the conversation gets filled
 * in afterwards from memory, and the whole point of these is not to.
 */
export function MeetingTemplates({ c, own }: { c: MeetingTemplatesCopy; own: MeetingTemplate[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');
  const [, start] = useTransition();

  const live = own.filter((t) => !t.archived);

  const copy = (kind: string) => {
    setCopying(kind);
    setCopyError('');
    start(async () => {
      const res = await copyBuiltInTemplate(kind);
      setCopying(null);
      if (!res.ok) setCopyError(res.error ?? c.saveFailed);
    });
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-ink-mute">{c.sub}</p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setEditing(null); }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} aria-hidden strokeWidth={1.5} />
            {c.add}
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-5">
          <Editor c={c} onDone={() => setAdding(false)} />
        </div>
      )}

      {/* The standing ones. Shown as what they are, a list to copy from. */}
      <div className="mt-7">
        <p className="eyebrow">{c.builtIn}</p>
        <p className="mt-1 text-[12.5px] text-ink-mute">{c.builtInHint}</p>
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {BUILT_IN_TEMPLATES.map((t) => (
            <li key={t.kind} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink">{t.title}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-mute">
                  {t.when} · {c.questionsCount.replace('{n}', String(questionCount(t)))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(t.kind)}
                disabled={copying !== null}
                className="btn-quiet inline-flex shrink-0 items-center gap-1.5 px-3 text-[13.5px] disabled:opacity-60"
              >
                <Copy size={14} aria-hidden strokeWidth={1.5} />
                {copying === t.kind ? c.copying : c.copy}
              </button>
            </li>
          ))}
        </ul>
        {copyError && (
          <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {copyError}
          </p>
        )}
      </div>

      {/* Theirs. */}
      <div className="mt-8">
        <p className="eyebrow">{c.own}</p>
        {live.length === 0 && !adding ? (
          <p className="mt-3 text-[14.5px] text-ink-mute">{c.none}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {live.map((t) => {
              const on = editing === t.id;
              return (
                <li key={t.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditing(on ? null : t.id ?? null); setAdding(false); }}
                      aria-expanded={on}
                      className="min-w-0 flex-1 text-start"
                    >
                      <p className="text-[15px] text-ink">{t.title}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-mute">
                        {t.when ? `${t.when} · ` : ''}
                        {c.questionsCount.replace('{n}', String(questionCount(t)))}
                      </p>
                    </button>

                    <form
                      action={removeMeetingTemplate}
                      onSubmit={(e) => { if (!confirm(c.removeAsk)) e.preventDefault(); }}
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="btn-quiet px-2 py-1" aria-label={`${c.remove} ${t.title}`}>
                        <Trash2 size={14} aria-hidden strokeWidth={1.5} />
                      </button>
                    </form>
                  </div>

                  {on && (
                    <div className="mt-3">
                      <Editor c={c} template={t} onDone={() => setEditing(null)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── the editor ──────────────────────────────────────────────────────────── */

type EditField = { key: string; id: string; label: string; kind: FieldKind; options: string; hint: string };
type EditSection = { key: string; title: string; fields: EditField[] };

/* An id a question keeps for life. Lower case and digits only, because the
   reader refuses anything else and would hand the question a new id — and a
   question with a new id is one whose old answers have vanished. */
const newId = () => `f${Math.random().toString(36).slice(2, 8)}`;
const blankField = (): EditField => {
  const id = newId();
  return { key: id, id, label: '', kind: 'text', options: '', hint: '' };
};
const blankSection = (): EditSection => ({ key: newId(), title: '', fields: [blankField()] });

const fromTemplate = (t: MeetingTemplate): EditSection[] =>
  t.sections.map((s, i) => ({
    key: `s${i}`,
    title: s.title,
    fields: s.fields.map((f) => ({
      key: f.id, id: f.id, label: f.label, kind: f.kind,
      options: (f.options ?? []).join('\n'), hint: f.hint ?? '',
    })),
  }));

const move = <T,>(list: T[], i: number, by: -1 | 1): T[] => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

function Editor({ c, template, onDone }: {
  c: MeetingTemplatesCopy; template?: MeetingTemplate; onDone: () => void;
}) {
  const [name, setName] = useState(template?.title ?? '');
  const [when, setWhen] = useState(template?.when ?? '');
  const [blurb, setBlurb] = useState(template?.blurb ?? '');
  const [sections, setSections] = useState<EditSection[]>(
    template?.sections.length ? fromTemplate(template) : [blankSection()],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setSection = (si: number, patch: Partial<EditSection>) =>
    setSections((all) => all.map((s, n) => (n === si ? { ...s, ...patch } : s)));
  const setField = (si: number, fi: number, patch: Partial<EditField>) =>
    setSection(si, { fields: sections[si].fields.map((f, n) => (n === fi ? { ...f, ...patch } : f)) });

  const submit = async () => {
    const payload = sections.map((s) => ({
      title: s.title,
      fields: s.fields.map((f) => ({
        id: f.id, label: f.label, kind: f.kind, hint: f.hint,
        options: f.options.split('\n').map((o) => o.trim()).filter(Boolean),
      })),
    }));
    if (!payload.some((s) => s.fields.some((f) => f.label.trim()))) {
      setError(c.noQuestions);
      return;
    }
    setSaving(true);
    setError('');
    const res = await saveMeetingTemplate({
      id: template?.id, name, when, blurb, offsetDays: template?.offsetDays ?? null, sections: payload,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? c.saveFailed); return; }
    onDone();
  };

  const icon = 'btn-quiet grid size-9 place-items-center p-0 disabled:opacity-40 sm:size-8';

  return (
    <div className="rounded-card-sm bg-surface-100 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[12.5px] text-ink-mute">
          {c.name}
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            maxLength={120} placeholder={c.namePh}
            className="field mt-1 w-full" autoComplete="off"
          />
        </label>
        <label className="block text-[12.5px] text-ink-mute">
          {c.when}
          <input
            value={when} onChange={(e) => setWhen(e.target.value)}
            maxLength={120} placeholder={c.whenPh}
            className="field mt-1 w-full" autoComplete="off"
          />
        </label>
        <label className="block text-[12.5px] text-ink-mute sm:col-span-2">
          {c.blurb}
          <input
            value={blurb} onChange={(e) => setBlurb(e.target.value)}
            maxLength={400} placeholder={c.blurbPh}
            className="field mt-1 w-full" autoComplete="off"
          />
        </label>
      </div>

      <p className="mt-5 text-[13px] text-accent">{c.sections}</p>
      <ul className="mt-2 space-y-3">
        {sections.map((s, si) => (
          <li key={s.key} className="rounded-control border border-line bg-card p-3">
            <div className="flex items-center gap-2">
              <input
                value={s.title} onChange={(e) => setSection(si, { title: e.target.value })}
                maxLength={80} placeholder={c.sectionTitlePh} aria-label={c.sectionTitle}
                className="field min-w-0 flex-1" autoComplete="off"
              />
              <button type="button" className={icon} aria-label={c.moveUp} disabled={si === 0}
                onClick={() => setSections((all) => move(all, si, -1))}>
                <ArrowUp size={14} aria-hidden strokeWidth={1.5} />
              </button>
              <button type="button" className={icon} aria-label={c.moveDown} disabled={si === sections.length - 1}
                onClick={() => setSections((all) => move(all, si, 1))}>
                <ArrowDown size={14} aria-hidden strokeWidth={1.5} />
              </button>
              <button type="button" className={icon} aria-label={c.removeSection} disabled={sections.length === 1}
                onClick={() => setSections((all) => all.filter((_, n) => n !== si))}>
                <X size={15} aria-hidden strokeWidth={1.5} />
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {s.fields.map((f, fi) => (
                <li key={f.key} className="rounded-control bg-surface-100 p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto] sm:items-center">
                    <input
                      value={f.label} onChange={(e) => setField(si, fi, { label: e.target.value })}
                      maxLength={120} placeholder={c.questionPh} aria-label={c.question}
                      className="field" autoComplete="off"
                    />
                    <select
                      value={f.kind} onChange={(e) => setField(si, fi, { kind: e.target.value as FieldKind })}
                      aria-label={c.kind} className="field"
                    >
                      {FIELD_KINDS.map((k) => <option key={k} value={k}>{c.kinds[k]}</option>)}
                    </select>
                    <span className="flex gap-1">
                      <button type="button" className={icon} aria-label={c.moveUp} disabled={fi === 0}
                        onClick={() => setSection(si, { fields: move(s.fields, fi, -1) })}>
                        <ArrowUp size={14} aria-hidden strokeWidth={1.5} />
                      </button>
                      <button type="button" className={icon} aria-label={c.moveDown} disabled={fi === s.fields.length - 1}
                        onClick={() => setSection(si, { fields: move(s.fields, fi, 1) })}>
                        <ArrowDown size={14} aria-hidden strokeWidth={1.5} />
                      </button>
                      <button type="button" className={icon} aria-label={c.removeQuestion} disabled={s.fields.length === 1}
                        onClick={() => setSection(si, { fields: s.fields.filter((_, n) => n !== fi) })}>
                        <X size={15} aria-hidden strokeWidth={1.5} />
                      </button>
                    </span>
                  </div>
                  {f.kind === 'choice' && (
                    <textarea
                      value={f.options} onChange={(e) => setField(si, fi, { options: e.target.value })}
                      rows={3} placeholder={c.optionsPh} aria-label={c.options}
                      className="field mt-2 w-full resize-y text-[13.5px]"
                    />
                  )}
                  <input
                    value={f.hint} onChange={(e) => setField(si, fi, { hint: e.target.value })}
                    maxLength={200} placeholder={`${c.hint}: ${c.hintPh}`} aria-label={c.hint}
                    className="field mt-2 w-full text-[13px]" autoComplete="off"
                  />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setSection(si, { fields: [...s.fields, blankField()] })}
              className="btn-quiet mt-2 inline-flex items-center gap-1.5 px-3 text-[13.5px]"
            >
              <Plus size={14} aria-hidden strokeWidth={1.5} />
              {c.addQuestion}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setSections((all) => [...all, blankSection()])}
        className="btn-quiet mt-3 inline-flex items-center gap-1.5 px-3 text-[13.5px]"
      >
        <Plus size={14} aria-hidden strokeWidth={1.5} />
        {c.addSection}
      </button>

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
