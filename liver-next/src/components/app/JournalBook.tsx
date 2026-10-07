'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, ImagePlus, MapPin, Pencil } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { supabaseBrowser } from '@/lib/supabase/client';
import { saveCritiqueLog, updateCritiqueLog, deleteCritiqueLog, type JournalResult } from '@/app/actions/journal';
import type { JournalLog } from '@/lib/circle';
import { fill } from '@/lib/copyText';
import {
  PRO_TAGS, CON_TAGS, EVENT_STYLES, summarise,
  type CritiqueArea,
} from '@/content/critique';

/**
 * The couple's journal of other people's weddings.
 *
 * Three things on one screen, in the order they are used: the form, which
 * is a set of chips because nobody writes paragraphs in a car at midnight;
 * the weddings already written down; and the summary, which is the whole
 * reason to keep the journal at all — a year of "the bar was slow" adds up
 * to one line under Bar, read on the day the bar gets booked.
 *
 * Read-only for the producer. It is the couple's own notebook, and a
 * producer editing it would be answering a question nobody asked them.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const extOf = (type: string, name: string) => {
  const fromName = (name.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1] ?? '').toLowerCase();
  return fromName || (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');
};

function SaveButton() {
  const c = useCopy().journal;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.adding : c.form.save}</button>;
}

function Chips({ name, tags, labels, picked, onPick }: {
  name: string;
  tags: readonly { key: string }[];
  labels: Record<string, string>;
  picked: Set<string>;
  onPick: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = picked.has(t.key);
        return (
          <button
            key={t.key} type="button" onClick={() => onPick(t.key)} aria-pressed={on}
            className={`min-h-[40px] rounded-button border px-3.5 text-body transition ${
              on ? 'border-accent bg-accent text-white' : 'border-line-strong bg-card text-ink-soft hover:border-accent/50'
            }`}
          >
            {labels[t.key] ?? t.key}
            {on && <input type="hidden" name={name} value={t.key} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The one form, used to write an entry and to correct one.
 *
 * Deliberately not two. Everything in here — the chips, the upload straight
 * to storage, the five fields — would otherwise be built a second time, and
 * in this product a thing built twice is a thing built nought times: that is
 * exactly how the guest list went a year with no way to fix a name.
 *
 * In edit mode the uploader stays, and the action appends rather than
 * replaces, because this screen only ever holds signed URLs and never the
 * paths behind them.
 */
function LogForm({ clientId, log, onDone }: { clientId: string; log?: JournalLog; onDone: () => void }) {
  const c = useCopy().journal;
  const [state, action] = useActionState<JournalResult | null, FormData>(
    log ? updateCritiqueLog : saveCritiqueLog, null,
  );
  const [pros, setPros] = useState<Set<string>>(new Set(log?.pros ?? []));
  const [cons, setCons] = useState<Set<string>>(new Set(log?.cons ?? []));
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ n: number; m: number } | null>(null);
  const [upErr, setUpErr] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  const toggle = (set: Set<string>, put: (s: Set<string>) => void) => (key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    put(next);
  };

  /* Straight from the browser to storage, under this workspace's own
     folder, which is what the bucket policy reads to decide. The action
     then stores the paths and checks them again. */
  const upload = async (list: File[]) => {
    if (list.length === 0) return;
    setUpErr('');
    const sb = supabaseBrowser();
    const landed: string[] = [];
    for (const [i, file] of list.entries()) {
      setBusy({ n: i + 1, m: list.length });
      if (file.size > MAX_BYTES) continue;
      const type = file.type || 'image/jpeg';
      if (!IMAGES.includes(type)) continue;
      const path = `${clientId}/journal-${crypto.randomUUID()}.${extOf(type, file.name)}`;
      const { error } = await sb.storage.from('files').upload(path, file, { contentType: type, upsert: false });
      if (!error) landed.push(path);
    }
    setBusy(null);
    if (input.current) input.current.value = '';
    if (landed.length === 0) setUpErr(c.form.photosHint);
    setPhotos((p) => [...p, ...landed]);
  };

  return (
    <form action={action} className="card space-y-5">
      <input type="hidden" name="client_id" value={clientId} />
      {log && <input type="hidden" name="id" value={log.id} />}
      {photos.map((p) => <input key={p} type="hidden" name="photos" value={p} />)}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-body text-ink-soft sm:col-span-1">{c.form.venue}
          <input name="venue_name" defaultValue={log?.venue_name ?? ''} className="field" placeholder={c.form.venuePh} autoComplete="off"  enterKeyHint="next" /></label>
        <label className="grid gap-1.5 text-body text-ink-soft">{c.form.date}
          <input name="event_date" type="date" defaultValue={log?.event_date ?? ''} className="field"  autoComplete="off" enterKeyHint="done" /></label>
        <label className="grid gap-1.5 text-body text-ink-soft">{c.form.style}
          <select name="style" className="field" defaultValue={log?.style ?? ''}>
            <option value="" />
            {EVENT_STYLES.map((s) => <option key={s} value={s}>{c.form.styles[s]}</option>)}
          </select>
        </label>
      </div>

      <div>
        <p className="label">{c.form.pros}</p>
        <Chips name="pros" tags={PRO_TAGS} labels={c.tags} picked={pros} onPick={toggle(pros, setPros)} />
        <input name="pros_note" defaultValue={log?.pros_note ?? ''} className="field mt-3" placeholder={c.form.prosPh} aria-label={c.form.prosNote} autoComplete="off" />
      </div>

      <div>
        <p className="label">{c.form.cons}</p>
        <Chips name="cons" tags={CON_TAGS} labels={c.tags} picked={cons} onPick={toggle(cons, setCons)} />
        <input name="cons_note" defaultValue={log?.cons_note ?? ''} className="field mt-3" placeholder={c.form.consPh} aria-label={c.form.consNote} autoComplete="off" />
      </div>

      <div>
        <label className="label" htmlFor="takeaways">{c.form.takeaways}</label>
        <textarea id="takeaways" name="takeaways" rows={3} defaultValue={log?.takeaways ?? ''} className="field" placeholder={c.form.takeawaysPh} />
        <p className="mt-1.5 text-meta text-ink-mute">{c.form.takeawaysHint}</p>
      </div>

      <div>
        <p className="label">{c.form.photos}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-button border border-line-strong bg-card px-4 text-body text-ink transition hover:border-accent/50">
            <ImagePlus size={16} aria-hidden strokeWidth={1.5} />
            {busy ? fill(c.form.photosBusy, { n: busy.n, m: busy.m }) : c.form.photosAdd}
            <input
              ref={input} type="file" multiple accept="image/*" className="sr-only" aria-label={c.form.photosAdd}
              onChange={(e) => void upload(Array.from(e.target.files ?? []))}
            />
          </label>
          {photos.length > 0 && <span className="text-body text-ink-soft">{photos.length}</span>}
        </div>
        <p className="mt-1.5 text-meta text-ink-mute">{c.form.photosHint}</p>
        {upErr && <p role="alert" className="mt-2 text-body text-bad">{upErr}</p>}
      </div>

      {state && !state.ok && state.error && <p role="alert" className="text-body text-bad">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <SaveButton />
        <button type="button" onClick={onDone} className="btn-quiet text-body">{c.cancel}</button>
      </div>
    </form>
  );
}

function LogCard({ log, clientId, viewer }: {
  log: JournalLog; clientId: string; viewer: 'producer' | 'client';
}) {
  const c = useCopy().journal;
  const [editing, setEditing] = useState(false);
  const lines = log.takeaways.split('\n').map((l) => l.trim()).filter(Boolean);

  if (editing) return <LogForm clientId={clientId} log={log} onDone={() => setEditing(false)} />;

  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="head-panel inline-flex items-center gap-2">
            <MapPin size={16} aria-hidden strokeWidth={1.5} className="text-accent" />
            {log.venue_name || c.card.at}
          </h3>
          <p className="mt-1 text-body text-ink-mute">
            {log.event_date ?? c.card.noDate}
            {log.style && <span> · {c.form.styles[log.style as keyof typeof c.form.styles] ?? log.style}</span>}
          </p>
        </div>
        {viewer === 'client' && (
          <div className="flex shrink-0 items-start gap-0.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={c.edit}
              title={c.edit}
              className="grid size-9 place-items-center rounded-control text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.5} aria-hidden />
            </button>
            <DeleteForm action={deleteCritiqueLog}>
              <input type="hidden" name="id" value={log.id} />
              <button type="submit" className="btn-quiet px-2 text-body">{c.remove}</button>
            </DeleteForm>
          </div>
        )}
      </div>

      {(log.pros.length > 0 || log.pros_note) && (
        <div className="mt-4">
          <p className="text-meta font-semibold tracking-[.06em] text-ok">{c.summary.worked}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {log.pros.map((k) => <span key={k} className="chip chip-ok">{c.tags[k as keyof typeof c.tags] ?? k}</span>)}
          </div>
          {log.pros_note && <p className="mt-2 text-body text-ink-soft">{log.pros_note}</p>}
        </div>
      )}

      {(log.cons.length > 0 || log.cons_note) && (
        <div className="mt-4">
          <p className="text-meta font-semibold tracking-[.06em] text-bad">{c.summary.avoid}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {log.cons.map((k) => <span key={k} className="chip chip-bad">{c.tags[k as keyof typeof c.tags] ?? k}</span>)}
          </div>
          {log.cons_note && <p className="mt-2 text-body text-ink-soft">{log.cons_note}</p>}
        </div>
      )}

      {lines.length > 0 && (
        <div className="mt-4 rounded-card-sm bg-accent-wash p-3.5">
          <p className="text-meta font-semibold tracking-[.06em] text-accent">{c.summary.ours}</p>
          <ul className="mt-1.5 list-none space-y-1 p-0">
            {lines.map((l, i) => <li key={i} className="text-body text-ink">{l}</li>)}
          </ul>
        </div>
      )}

      {log.photoUrls.length > 0 && (
        <ul className="mt-4 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
          {log.photoUrls.map((u) => (
            <li key={u} className="overflow-hidden rounded-card-sm border border-line">
              {/* signed one-off links, not a fixed asset path */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`${c.card.photos} · ${log.venue_name}`} className="h-24 w-full object-cover" loading="lazy" />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

const AREA_TONE: Record<CritiqueArea, string> = {
  catering: 'bg-blush-wash', bar: 'bg-sage-wash', design: 'bg-accent-wash', timing: 'bg-surface-200', other: 'bg-surface-200',
};

export function JournalBook({ clientId, logs, viewer }: {
  clientId: string; logs: JournalLog[]; viewer: 'producer' | 'client';
}) {
  const c = useCopy().journal;
  const [adding, setAdding] = useState(false);
  const rows = summarise(logs);

  return (
    <div className="space-y-6">
      {viewer === 'client' && (
        adding
          ? <LogForm clientId={clientId} onDone={() => setAdding(false)} />
          : (
            <button type="button" onClick={() => setAdding(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={17} aria-hidden strokeWidth={1.5} />{c.add}
            </button>
          )
      )}

      {rows.length > 0 && (
        <section className="card">
          <h2 className="head-section">{c.summary.title}</h2>
          <p className="mt-1 max-w-2xl text-body leading-relaxed text-ink-soft">{c.summary.sub}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.area} className={`rounded-card-sm p-4 ${AREA_TONE[r.area]}`}>
                <h3 className="text-lead font-semibold text-ink">{c.summary.areas[r.area]}</h3>
                {r.pros.length > 0 && (
                  <p className="mt-2 text-body text-ink-soft">
                    <span className="font-medium text-ok">{c.summary.worked}: </span>
                    {r.pros.map((p) => `${c.tags[p.key as keyof typeof c.tags] ?? p.key}${p.n > 1 ? ` (${fill(c.summary.times, { n: p.n })})` : ''}`).join(', ')}
                  </p>
                )}
                {r.cons.length > 0 && (
                  <p className="mt-1.5 text-body text-ink-soft">
                    <span className="font-medium text-bad">{c.summary.avoid}: </span>
                    {r.cons.map((p) => `${c.tags[p.key as keyof typeof c.tags] ?? p.key}${p.n > 1 ? ` (${fill(c.summary.times, { n: p.n })})` : ''}`).join(', ')}
                  </p>
                )}
                {r.takeaways.length > 0 && (
                  <ul className="mt-3 list-none space-y-1 border-t border-line pt-2.5 p-0">
                    {r.takeaways.map((t, i) => (
                      <li key={i} className="text-body text-ink">
                        {t.line}
                        {t.venue && <span className="text-ink-mute"> · {t.venue}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {logs.length === 0 ? (
        <p className="card text-lead text-ink-mute">{viewer === 'client' ? c.none : c.noneProducer}</p>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => <LogCard key={log.id} log={log} clientId={clientId} viewer={viewer} />)}
        </div>
      )}
    </div>
  );
}
