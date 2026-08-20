'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addDayItem, deleteDayItem, renameTracks, type DayResult, type Track } from '@/app/actions/day';
import { dayCopy } from '@/content/site';

export type DayItem = { id: string; track: Track; at_time: string; title: string; note: string };

/** Postgres hands back "09:00:00"; nobody writes the seconds on a schedule. */
const hhmm = (t: string) => (t || '').slice(0, 5);

function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>{pending ? busy : label}</button>;
}

export function DaySchedule({ clientId, items, labelA, labelB }: {
  clientId: string; items: DayItem[]; labelA: string; labelB: string;
}) {
  const [addState, addAction] = useActionState<DayResult | null, FormData>(addDayItem, null);
  const [nameState, nameAction] = useActionState<DayResult | null, FormData>(renameTracks, null);
  const [renaming, setRenaming] = useState(false);
  const c = dayCopy;

  const tracks: { key: Track; label: string; tone: string }[] = [
    { key: 'partner_a', label: labelA, tone: 'bg-azure-50' },
    { key: 'shared',    label: c.shared, tone: 'bg-emerald-50' },
    { key: 'partner_b', label: labelB, tone: 'bg-haze-100' },
  ];

  const of = (t: Track) =>
    items.filter((i) => i.track === t).sort((a, b) => hhmm(a.at_time).localeCompare(hhmm(b.at_time)));

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink">⏱ {c.title}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
        </div>
        <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setRenaming((v) => !v)}>
          {c.rename}
        </button>
      </div>

      {renaming && (
        <form action={nameAction} className="mt-4 grid gap-3 rounded-2xl bg-haze-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <input name="track_a_label" defaultValue={labelA} maxLength={40} className="field" aria-label={labelA} />
          <input name="track_b_label" defaultValue={labelB} maxLength={40} className="field" aria-label={labelB} />
          <Busy label={c.renameSave} busy={c.adding} />
          <p className="text-[12.5px] text-ink-mute sm:col-span-3">{c.renameHint}</p>
        </form>
      )}
      {nameState && !nameState.ok && nameState.error && (
        <p role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-800">{nameState.error}</p>
      )}

      <form action={addAction} className="mt-5 grid gap-3 sm:grid-cols-[110px_1fr_1fr_150px_auto]">
        <input type="hidden" name="client_id" value={clientId} />
        <input name="at_time" type="time" required className="field" aria-label={c.time} />
        <input name="title" required placeholder={c.addTitlePh} autoComplete="off" className="field" aria-label={c.addTitle} />
        <input name="note" placeholder={c.notePh} autoComplete="off" className="field" aria-label={c.note} />
        <select name="track" defaultValue="shared" className="field" aria-label={c.track}>
          <option value="partner_a">{labelA}</option>
          <option value="shared">{c.shared}</option>
          <option value="partner_b">{labelB}</option>
        </select>
        <Busy label={c.add} busy={c.adding} />
      </form>
      {addState && !addState.ok && addState.error && (
        <p role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-800">{addState.error}</p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {tracks.map((t) => (
            <div key={t.key} className={`rounded-2xl p-4 ${t.tone}`}>
              <h3 className="text-[13.5px] font-semibold text-ink">{t.label}</h3>
              {of(t.key).length === 0 ? (
                <p className="mt-3 text-[13.5px] text-ink-mute">{c.emptyTrack}</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {of(t.key).map((i) => (
                    <li key={i.id} className="flex gap-3">
                      <span className="w-[46px] shrink-0 tabular-nums text-[14px] font-semibold text-ink" dir="ltr">
                        {hhmm(i.at_time)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] text-ink">{i.title}</p>
                        {i.note && <p className="text-[12.5px] text-ink-mute">{i.note}</p>}
                      </div>
                      <form action={deleteDayItem}>
                        <input type="hidden" name="item_id" value={i.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <button type="submit" className="btn-quiet px-1.5 py-0 text-[12.5px]" title={c.remove}>✕</button>
                      </form>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
