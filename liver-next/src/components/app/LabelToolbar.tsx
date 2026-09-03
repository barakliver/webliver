'use client';

import { useActionState, useState } from 'react';
import { Check, Palette, Plus, Trash2, X } from 'lucide-react';
import { addLabel, updateLabel, removeLabel, type LabelResult, type LabelKind, type ProducerLabel } from '@/app/actions/labels';
import { PALETTE } from '@/content/palette';
import { labelCopy as c } from '@/content/site';
import { cn } from '@/lib/utils';

/**
 * The producer's own taxonomy, edited where it is read.
 *
 * Two uses, one component: the colours their diary is scanned by, and the
 * channels their enquiries arrive through. They are the same shape — a word,
 * an order, a colour — so they are the same toolbar, and a producer who
 * learns one has learned the other.
 *
 * The colours are a shortlist rather than a wheel. Every tone was picked to
 * carry a label on this ground and to stay apart from its neighbours at chip
 * size; a free picker hands somebody a yellow that vanishes on white, and
 * they find out on the morning they are scanning for a tasting.
 */
export function LabelToolbar({ kind, labels, builtIn = [] }: {
  kind: LabelKind;
  labels: ProducerLabel[];
  /** Names the platform ships, shown greyed so a producer does not add a
   *  second "וואטסאפ" beside the one that already exists. */
  builtIn?: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [color, setColor] = useState(PALETTE[0].hex);
  const [editing, setEditing] = useState<string | null>(null);

  const [state, action, pending] = useActionState<LabelResult | null, FormData>(
    async (prev, form) => {
      const r = await addLabel(prev, form);
      if (r.ok) { setAdding(false); setColor(PALETTE[0].hex); }
      return r;
    },
    null,
  );

  const isTags = kind === 'event_tag';

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <Palette size={17} strokeWidth={1.5} aria-hidden />
            {isTags ? c.tagsTitle : c.channelsTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            {isTags ? c.tagsSub : c.channelsSub}
          </p>
        </div>
        <button
          type="button" onClick={() => setAdding((v) => !v)}
          className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]"
        >
          {adding ? <X size={14} strokeWidth={1.5} aria-hidden /> : <Plus size={14} strokeWidth={1.5} aria-hidden />}
          {c.add}
        </button>
      </div>

      {adding && (
        <form action={action} className="mt-4 rounded-xl2 border border-line bg-surface-100 p-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="label" htmlFor={`new-${kind}`}>{isTags ? c.addPh : c.addChannelPh}</label>
              <input id={`new-${kind}`} name="label" maxLength={40} autoComplete="off" className="field" autoFocus />
            </div>
            <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>
          </div>
          <Swatches value={color} onPick={setColor} />
          {state && !state.ok && state.error && (
            <p role="alert" className="mt-2 text-[13px] text-bad">{state.error}</p>
          )}
        </form>
      )}

      {labels.length === 0 && !adding ? (
        <p className="mt-5 text-[14px] text-ink-mute">{isTags ? c.none : c.noneChannels}</p>
      ) : (
        <ul className="mt-5 flex flex-wrap gap-2">
          {labels.map((l) => (
            <li key={l.id}>
              {editing === l.id ? (
                <EditRow label={l} onDone={() => setEditing(null)} />
              ) : (
                <span className="inline-flex items-center gap-2 rounded-xl2 border border-line bg-card px-3 py-1.5">
                  <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: l.color }} />
                  <button
                    type="button" onClick={() => setEditing(l.id)}
                    className="text-[13.5px] text-ink transition hover:text-accent"
                    aria-label={`${c.rename}: ${l.label}`}
                  >
                    {l.label}
                  </button>
                  <form action={removeLabel}>
                    <input type="hidden" name="label_id" value={l.id} />
                    <button
                      type="submit" aria-label={`${c.remove}: ${l.label}`}
                      className="grid size-6 place-items-center rounded-full text-ink-mute transition hover:bg-bad-wash hover:text-bad"
                    >
                      <Trash2 size={12} strokeWidth={1.5} aria-hidden />
                    </button>
                  </form>
                </span>
              )}
            </li>
          ))}

          {builtIn.map((b) => (
            <li key={b}>
              <span className="inline-flex items-center gap-2 rounded-xl2 border border-dashed border-line px-3 py-1.5 text-[13.5px] text-ink-mute">
                {b}
                <span className="text-[11px]">{c.builtIn}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditRow({ label, onDone }: { label: ProducerLabel; onDone: () => void }) {
  const [color, setColor] = useState(label.color);
  const [state, action, pending] = useActionState<LabelResult | null, FormData>(
    async (prev, form) => {
      const r = await updateLabel(prev, form);
      if (r.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={action} className="rounded-xl2 border border-accent/40 bg-surface-100 p-3">
      <input type="hidden" name="label_id" value={label.id} />
      <input type="hidden" name="color" value={color} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="label" defaultValue={label.label} maxLength={40} autoComplete="off"
          className="field min-h-[36px] w-[180px] py-1 text-[13.5px]" aria-label={c.rename} autoFocus
        />
        <button type="submit" className="btn-primary min-h-[36px] px-3 text-[13px]" disabled={pending}>
          {pending ? c.saving : c.save}
        </button>
        <button type="button" onClick={onDone} aria-label={c.close} className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink">
          <X size={15} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <Swatches value={color} onPick={setColor} />
      {state && !state.ok && state.error && <p role="alert" className="mt-2 text-[13px] text-bad">{state.error}</p>}
    </form>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  return (
    <div className="mt-3">
      <p className="label">{c.color}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={c.color}>
        {PALETTE.map((s) => {
          const on = s.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={s.hex} type="button" onClick={() => onPick(s.hex)}
              aria-pressed={on} aria-label={s.label} title={s.label}
              className={cn(
                'grid size-8 place-items-center rounded-full transition',
                on ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface-100' : 'hover:scale-110',
              )}
              style={{ background: s.hex }}
            >
              {on && <Check size={13} strokeWidth={2} color="#fff" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
