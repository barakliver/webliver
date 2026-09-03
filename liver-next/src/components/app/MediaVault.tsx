'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize2, Settings2, Tag, X } from 'lucide-react';
import { deleteFile, tagFile } from '@/app/actions/files';
import { MEDIA_TAGS, type MediaTag } from '@/lib/fileTypes';
import { useCopy } from '@/components/app/CopyProvider';
import { longDate } from '@/lib/appDates';
import { cn } from '@/lib/utils';
import { Ltr } from '@/components/Ltr';
import type { EventFile } from './EventFiles';

type Filter = 'all' | MediaTag | 'untagged';

/**
 * The pictures of one event, sorted by the four words people use for them.
 *
 * A grid of sixty thumbnails is not a gallery, it is a place pictures go to
 * be lost. The tags are the whole design: the strip at the top is what makes
 * "show me the hall" a tap rather than a scroll, and a picture that arrived
 * without one sits under its own word so it can be given one.
 *
 * The lightbox is a dialog rather than a new tab. A signed link opened in a
 * tab is a picture without its neighbours; here the arrow keys walk the set,
 * and the caption underneath is the note somebody wrote when they added it.
 *
 * Managing is a mode, not a row of buttons under every thumbnail. Most visits
 * to this grid are to look; the controls appear only when somebody says they
 * came to tidy, and the grid stays a grid the rest of the time.
 */
export function MediaVault({ clientId, photos, viewer }: {
  clientId: string; photos: EventFile[]; viewer: 'producer' | 'client';
}) {
  const ui = useCopy();
  const c = ui.files.media;
  const [filter, setFilter] = useState<Filter>('all');
  const [managing, setManaging] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [, start] = useTransition();

  const shown = useMemo(() => photos.filter((p) =>
    filter === 'all' ? true : filter === 'untagged' ? !p.tag : p.tag === filter,
  ), [photos, filter]);

  const counts = useMemo(() => {
    const m = new Map<Filter, number>([['all', photos.length], ['untagged', photos.filter((p) => !p.tag).length]]);
    MEDIA_TAGS.forEach((t) => m.set(t, photos.filter((p) => p.tag === t).length));
    return m;
  }, [photos]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: c.all },
    ...MEDIA_TAGS.map((t) => ({ key: t as Filter, label: c.tags[t] })),
    { key: 'untagged', label: c.untagged },
  ];

  /* A filter left pointing at a word with nothing under it, after the last
     picture was retagged away, snaps back to everything. */
  useEffect(() => {
    if (filter !== 'all' && (counts.get(filter) ?? 0) === 0) setFilter('all');
  }, [counts, filter]);

  const retag = (f: EventFile, tag: string) => start(() => { void tagFile({ fileId: f.id, clientId, tag }); });
  const remove = (f: EventFile) => {
    const fd = new FormData();
    fd.set('file_id', f.id); fd.set('client_id', clientId);
    start(() => { void deleteFile(fd); });
  };

  const total = shown.length;
  const countLine = total === 1 ? c.one : c.count.replace('{n}', String(total));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] tracking-[.14em] text-ink-mute">{c.title}</p>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        {photos.length > 0 && (
          <button
            type="button" onClick={() => setManaging((v) => !v)} aria-pressed={managing}
            className={cn('btn-quiet inline-flex min-h-[38px] items-center gap-1.5 px-2.5 text-[13.5px]', managing && 'text-accent')}
          >
            <Settings2 size={15} strokeWidth={1.5} aria-hidden />
            {managing ? c.done : c.manage}
          </button>
        )}
      </div>

      {/* The strip. Counts on every word, because the count is the answer to
          "is there a picture of the hall yet" without opening the word. */}
      {photos.length > 0 && (
        <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => {
            const n = counts.get(f.key) ?? 0;
            if (f.key === 'untagged' && n === 0) return null;
            const on = filter === f.key;
            return (
              <button
                key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
                className={cn(
                  'inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl2 border px-3 text-[13px] transition-colors',
                  on ? 'border-ink bg-ink text-surface' : 'border-line text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {f.label}
                <span className={cn('tabular-nums text-[11.5px]', on ? 'text-surface/70' : 'text-ink-mute')}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {photos.length > 0 && <p className="mt-3 text-[12.5px] text-ink-mute">{countLine}</p>}

      {shown.length === 0 ? (
        <p className="mt-4 text-[14px] text-ink-mute">{photos.length === 0 ? (viewer === 'client' ? ui.files.none : ui.files.noneProducer) : c.none}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((f, i) => (
            <li key={f.id} className="group relative overflow-hidden rounded-card-sm border border-line bg-surface-100">
              <button
                type="button" onClick={() => setOpenIndex(i)}
                className="block w-full text-start"
                aria-label={`${c.open}: ${f.note || f.name}`}
              >
                {/* a plain img: these are signed one-off URLs, not a fixed asset path */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.note || f.name} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink/60 to-transparent p-2.5 text-surface opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="truncate text-[12px]">{f.note || f.name}</span>
                  <Maximize2 size={14} strokeWidth={1.5} aria-hidden className="shrink-0" />
                </span>
              </button>
              {f.tag && !managing && (
                <span className="pointer-events-none absolute start-2 top-2 rounded-xl2 bg-card/85 px-2 py-0.5 text-[11px] text-ink backdrop-blur">
                  {c.tags[f.tag as MediaTag]}
                </span>
              )}
              {managing && (
                <div className="flex items-center gap-1 border-t border-line bg-card p-1.5">
                  <label className="sr-only" htmlFor={`tag-${f.id}`}>{c.retag}</label>
                  <select
                    id={`tag-${f.id}`} value={f.tag} onChange={(e) => retag(f, e.target.value)}
                    className="field min-h-[34px] flex-1 px-2 py-1 text-[12.5px]"
                  >
                    <option value="">{c.untagged}</option>
                    {MEDIA_TAGS.map((t) => <option key={t} value={t}>{c.tags[t]}</option>)}
                  </select>
                  {(f.mine || viewer === 'producer') && (
                    <button
                      type="button" onClick={() => remove(f)}
                      className="grid size-9 shrink-0 place-items-center rounded-xl2 text-ink-mute transition hover:bg-bad-wash hover:text-bad"
                      aria-label={`${ui.files.remove} ${f.name}`}
                    >
                      <X size={15} strokeWidth={1.5} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {openIndex !== null && shown[openIndex] && (
        <Lightbox
          items={shown} index={openIndex}
          onIndex={setOpenIndex} onClose={() => setOpenIndex(null)}
          onRetag={viewer === 'producer' ? retag : undefined}
        />
      )}
    </div>
  );
}

function Lightbox({ items, index, onIndex, onClose, onRetag }: {
  items: EventFile[]; index: number;
  onIndex: (i: number) => void; onClose: () => void;
  onRetag?: (f: EventFile, tag: string) => void;
}) {
  const ui = useCopy();
  const c = ui.files.media;
  const f = items[index];
  const dateFmt = longDate(ui.locale);
  const many = items.length > 1;

  const prev = useCallback(() => onIndex((index - 1 + items.length) % items.length), [index, items.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      /* Arrow keys follow the reading direction of the page: in Hebrew the
         next picture is to the left, which is where the next-arrow points. */
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowLeft') (rtl ? next : prev)();
      if (e.key === 'ArrowRight') (rtl ? prev : next)();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [next, prev, onClose]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label={f.note || f.name}
      className="fixed inset-0 z-[80] flex flex-col bg-ink/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-surface" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-[13.5px]">
          <Ltr><span className="tabular-nums text-surface/70">{`${index + 1} / ${items.length}`}</span></Ltr>
          {f.tag && <span className="ms-3 rounded-xl2 bg-surface/15 px-2 py-0.5 text-[12px]">{c.tags[f.tag as MediaTag]}</span>}
        </p>
        <div className="flex items-center gap-1">
          <a
            href={`${f.url}${f.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(f.name)}`}
            className="grid size-10 place-items-center rounded-full text-surface/80 transition hover:bg-surface/15 hover:text-surface"
            aria-label={ui.files.download}
          >
            <Download size={18} strokeWidth={1.5} aria-hidden />
          </a>
          <button
            type="button" onClick={onClose} aria-label={c.close}
            className="grid size-10 place-items-center rounded-full text-surface/80 transition hover:bg-surface/15 hover:text-surface"
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={f.url} alt={f.note || f.name}
          className="max-h-full max-w-full rounded-card-sm object-contain shadow-pop"
          onClick={(e) => e.stopPropagation()}
        />
        {many && (
          <>
            <button
              type="button" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label={c.prev}
              className="absolute start-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/10 text-surface backdrop-blur transition hover:bg-surface/25 sm:start-4"
            >
              <ChevronRight size={22} strokeWidth={1.5} aria-hidden className="rtl:rotate-0 ltr:rotate-180" />
            </button>
            <button
              type="button" onClick={(e) => { e.stopPropagation(); next(); }} aria-label={c.next}
              className="absolute end-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/10 text-surface backdrop-blur transition hover:bg-surface/25 sm:end-4"
            >
              <ChevronLeft size={22} strokeWidth={1.5} aria-hidden className="rtl:rotate-0 ltr:rotate-180" />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-surface" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-[14px]">{f.note || f.name}</p>
          <p className="mt-0.5 text-[12.5px] text-surface/60">
            {ui.files.by} {f.uploader} · {dateFmt.format(new Date(f.created_at))}
          </p>
        </div>
        {onRetag && (
          <label className="inline-flex items-center gap-2 text-[12.5px] text-surface/80">
            <Tag size={14} strokeWidth={1.5} aria-hidden />
            <span className="sr-only">{c.retag}</span>
            <select
              value={f.tag} onChange={(e) => onRetag(f, e.target.value)}
              className="min-h-[36px] rounded-xl2 border border-surface/25 bg-surface/10 px-2.5 text-[12.5px] text-surface backdrop-blur [&>option]:text-ink"
            >
              <option value="">{c.untagged}</option>
              {MEDIA_TAGS.map((t) => <option key={t} value={t}>{c.tags[t]}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
