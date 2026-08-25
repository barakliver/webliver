'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Clock, Pencil, Plus, Trash2, TriangleAlert, Wand2 } from 'lucide-react';
import {
  addDayItem, updateDayItem, deleteDayItem, renameTracks, applyRunsheetTemplate, type DayResult,
} from '@/app/actions/day';
import { AUDIENCES, type Track } from '@/content/lists';
import { RUNSHEET_TEMPLATES } from '@/content/runsheets';
import { dayCopy } from '@/content/site';
import { hhmm, inDayOrder, spanOf, humanSpan, findOverlaps, crossesMidnight } from '@/lib/runsheet';

export type DayItem = {
  id: string; track: Track; at_time: string; title: string; note: string;
  owner: string; audience: string[]; duration_min: number | null;
  key_moment?: boolean | null;
};

const c = dayCopy;

function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 rounded-none border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
      {text}
    </p>
  );
}

const trackTone: Record<Track, string> = {
  partner_a: 'bg-accent-wash text-accent',
  shared: 'bg-surface-200 text-ink-soft',
  partner_b: 'bg-ok-wash text-ok',
};

/** The fields of one line, shared by adding and correcting so the two can
 *  never drift into offering different things. */
function LineFields({ item, labels, showOwner }: {
  item?: DayItem; labels: Record<Track, string>; showOwner: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_110px]">
        <div>
          <label className="label">{c.time}</label>
          <input name="at_time" type="time" required defaultValue={item ? hhmm(item.at_time) : ''} className="field" />
        </div>
        <div>
          <label className="label">{c.addTitle}</label>
          <input name="title" required defaultValue={item?.title} placeholder={c.addTitlePh} autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label">{c.duration}</label>
          <input
            name="duration_min" type="number" min={1} max={960} inputMode="numeric"
            defaultValue={item?.duration_min ?? ''} placeholder={c.durationPh} className="field"
          />
        </div>
      </div>

      {/* Producer only, and only a handful per evening. The evening screen
          counts down to these and to nothing else: a warning before all forty
          lines is a warning before none. */}
      {showOwner && (
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] text-ink-soft">
          <input
            type="checkbox" name="key_moment" defaultChecked={!!item?.key_moment}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {c.keyMoment}
          <span className="text-[12.5px] text-ink-mute">{c.keyMomentHint}</span>
        </label>
      )}

      <div className={`mt-3 grid gap-3 ${showOwner ? 'sm:grid-cols-[1fr_1fr_150px]' : 'sm:grid-cols-[1fr_150px]'}`}>
        <div>
          <label className="label">{c.note}</label>
          <input name="note" defaultValue={item?.note} placeholder={c.notePh} autoComplete="off" className="field" />
        </div>
        {/* Who is doing this is a staffing note, and staffing is the producer's
            side of the wall. The couple's copy of the schedule keeps the line
            and drops the name; the field is not sent at all rather than
            hidden, so a couple's save cannot blank what a producer wrote. */}
        {showOwner ? (
          <div>
            <label className="label">{c.owner}</label>
            <input name="owner" defaultValue={item?.owner} placeholder={c.ownerPh} autoComplete="off" className="field" />
          </div>
        ) : (
          <input type="hidden" name="owner" value={item?.owner ?? ''} />
        )}
        <div>
          <label className="label">{c.track}</label>
          <select name="track" defaultValue={item?.track ?? 'shared'} className="field">
            <option value="partner_a">{labels.partner_a}</option>
            <option value="shared">{labels.shared}</option>
            <option value="partner_b">{labels.partner_b}</option>
          </select>
        </div>
      </div>

      {/* Unticked means everyone, which is what most lines are. Tick a role and
          the line moves onto that person's printed sheet only, so this narrows
          rather than being a field to fill in before the schedule works. */}
      <fieldset className="mt-3">
        <legend className="sr-only">{c.audience}</legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13px] text-ink-mute">{c.audience}</span>
          {AUDIENCES.map((a) => (
            <label key={a.value} className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft">
              <input
                type="checkbox" name="audience" value={a.value}
                defaultChecked={item?.audience?.includes(a.value)}
                className="size-4 accent-accent"
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** One line of the day. Reads as a line until somebody chooses to change it,
 *  at which point it becomes the same form the line was written in. */
function Row({
  item, clientId, labels, span, clash, showOwner,
}: {
  item: DayItem; clientId: string; labels: Record<Track, string>;
  span: { minutes: number | null; stated: boolean };
  clash?: { withTitle: string };
  showOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<DayResult | null, FormData>(
    async (prev, form) => {
      const r = await updateDayItem(prev, form);
      if (r.ok) setEditing(false);
      return r;
    },
    null
  );

  if (editing) {
    return (
      <li className="rounded-none border border-accent/40 bg-surface-100 p-4">
        <form action={action} noValidate>
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <LineFields item={item} labels={labels} showOwner={showOwner} />
          {state && !state.ok && state.error && <Alert text={state.error} />}
          <div className="mt-4 flex flex-wrap gap-3">
            <Busy label={c.save} busy={c.adding} />
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>{c.cancel}</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`group flex gap-4 rounded-none border px-4 py-3.5 transition ${
      clash ? 'border-warn/30 bg-warn-wash/70' : 'border-line hover:border-line-strong'
    }`}>
      {/* Left to right inside a right-to-left page, because a clock reads that
          way in every language. */}
      <div className="w-[62px] shrink-0 text-center" dir="ltr">
        <div className="font-display text-[17px] font-light tabular-nums text-ink">{hhmm(item.at_time)}</div>
        {span.minutes !== null && (
          <div className={`mt-0.5 text-[11.5px] tabular-nums ${span.stated ? 'text-accent' : 'text-ink-mute'}`}>
            {span.stated ? humanSpan(span.minutes) : `↓ ${humanSpan(span.minutes)}`}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] text-ink">{item.title}</p>
        {item.note && <p className="mt-0.5 text-[13px] text-ink-soft">{item.note}</p>}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className={`rounded-none px-2 py-0.5 ${trackTone[item.track]}`}>{labels[item.track]}</span>
          {showOwner && item.owner && <span className="text-ink-mute">{item.owner}</span>}
          {item.audience.length > 0 && (
            <span className="text-ink-mute">
              {item.audience.map((a) => AUDIENCES.find((x) => x.value === a)?.label ?? a).join(' · ')}
            </span>
          )}
        </div>

        {clash && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-warn">
            <TriangleAlert size={14} aria-hidden strokeWidth={1.5} />
            {c.overlap(clash.withTitle)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-1">
        <button
          type="button" onClick={() => setEditing(true)}
          className="rounded-none p-1.5 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
          title={c.edit} aria-label={`${c.edit} ${item.title}`}
        >
          <Pencil size={15} aria-hidden strokeWidth={1.5} />
        </button>
        <form action={deleteDayItem}>
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <button
            type="submit"
            className="rounded-none p-1.5 text-ink-mute transition hover:bg-bad-wash hover:text-bad"
            title={c.remove} aria-label={`${c.remove} ${item.title}`}
          >
            <Trash2 size={15} aria-hidden strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </li>
  );
}

/** An empty schedule, offered a starting point.
 *
 *  Only while it is empty. A template is a hundred rows and there is no undo;
 *  merging one into an evening somebody already planned would be unpickable.
 *  The server checks this again for itself, because between this render and
 *  the click a partner may have started writing. */
function Templates({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<DayResult | null, FormData>(applyRunsheetTemplate, null);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="mt-5 rounded-none border border-dashed border-line-strong bg-surface-100 p-5">
      <h3 className="inline-flex items-center gap-2 font-display text-[16px] font-light text-ink">
        <Wand2 size={16} aria-hidden strokeWidth={1.5} />
        {c.templateTitle}
      </h3>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.templateSub}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {RUNSHEET_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={chosen === t.id}
            onClick={() => setChosen(t.id)}
            className={`rounded-none border p-4 text-right transition ${
              chosen === t.id
                ? 'border-accent bg-card'
                : 'border-line bg-card/60 hover:border-accent/40'
            }`}
          >
            <span className="block text-[14.5px] font-semibold text-ink">{t.label}</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-mute">{t.sub}</span>
            <span className="mt-2 block text-[12px] tabular-nums text-accent">{c.totalLines(t.lines.length)}</span>
          </button>
        ))}
      </div>

      {state && !state.ok && state.error && <Alert text={state.error} />}

      {chosen && (
        <form action={action} className="mt-4">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="template" value={chosen} />
          <Busy label={c.templateApply} busy={c.templateApplying} />
        </form>
      )}
    </div>
  );
}

/**
 * The day, in the order it happens.
 *
 * It used to be three columns, one per track, each sorted on its own. That
 * showed who was doing what and hid the only question anybody asks while
 * reading it: what happens next. Three lists cannot answer that, because the
 * answer alternates between them.
 *
 * So it is one timeline, and the track is a label on the line rather than the
 * shape of the page. What was lost by dropping the columns is small: which
 * track a line belongs to still reads at a glance, in colour.
 */
export function DaySchedule({ clientId, items, labelA, labelB, viewer = 'producer' }: {
  clientId: string; items: DayItem[]; labelA: string; labelB: string;
  viewer?: 'producer' | 'client';
}) {
  const showOwner = viewer === 'producer';
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const [addState, addAction] = useActionState<DayResult | null, FormData>(
    async (prev, form) => {
      const r = await addDayItem(prev, form);
      if (r.ok) setAdding(false);
      return r;
    },
    null
  );
  const [nameState, nameAction] = useActionState<DayResult | null, FormData>(renameTracks, null);

  const labels: Record<Track, string> = { partner_a: labelA, shared: c.shared, partner_b: labelB };

  const ordered = inDayOrder(items);
  const clashes = findOverlaps(ordered);
  const wraps = crossesMidnight(items.map((i) => i.at_time));

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-light text-ink">
            <Clock size={18} aria-hidden strokeWidth={1.5} />
            {c.title}
          </h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
          {ordered.length > 0 && (
            <p className="mt-1 text-[12.5px] text-ink-mute" dir="rtl">
              {c.totalLines(ordered.length)}
              {' · '}
              <span dir="ltr">
                {c.span(hhmm(ordered[0].at_time), hhmm(ordered[ordered.length - 1].at_time))}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setRenaming((v) => !v)}>
            {c.rename}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-none border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus size={15} aria-hidden strokeWidth={1.5} />
            {adding ? c.addClose : c.addOpen}
          </button>
        </div>
      </div>

      {renaming && (
        <form action={nameAction} className="mt-4 grid gap-3 rounded-none bg-surface-100 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <input name="track_a_label" defaultValue={labelA} maxLength={40} className="field" aria-label={labelA} />
          <input name="track_b_label" defaultValue={labelB} maxLength={40} className="field" aria-label={labelB} />
          <Busy label={c.renameSave} busy={c.adding} />
          <p className="text-[12.5px] text-ink-mute sm:col-span-3">{c.renameHint}</p>
        </form>
      )}
      {nameState && !nameState.ok && nameState.error && <Alert text={nameState.error} />}

      {adding && (
        <form action={addAction} className="mt-4 rounded-none border border-line bg-surface-100 p-4" noValidate>
          <input type="hidden" name="client_id" value={clientId} />
          <LineFields labels={labels} showOwner={showOwner} />
          {addState && !addState.ok && addState.error && <Alert text={addState.error} />}
          <div className="mt-4">
            <Busy label={c.add} busy={c.adding} />
          </div>
        </form>
      )}

      {ordered.length === 0 ? (
        <>
          <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
          <Templates clientId={clientId} />
        </>
      ) : (
        <>
          {wraps && (
            <p className="mt-5 rounded-none bg-surface-100 px-4 py-2.5 text-[13px] text-ink-soft">
              {c.crossesMidnight}
            </p>
          )}
          <ol className="mt-5 space-y-2.5">
            {ordered.map((item, i) => (
              <Row
                key={item.id}
                item={item}
                clientId={clientId}
                labels={labels}
                span={spanOf(ordered, i)}
                clash={clashes.get(item.id)}
                showOwner={showOwner}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
