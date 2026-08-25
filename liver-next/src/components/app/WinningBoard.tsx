'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadBoardImage, deleteBoardImage, type BoardResult } from '@/app/actions/board';
import { BOARD_CATEGORIES } from '@/content/lists';
import { appCopy } from '@/content/site';

export type BoardImage = {
  id: string; category: string; caption: string; url: string;
};

function Upload() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? appCopy.board.uploading : appCopy.board.upload}
    </button>
  );
}

const labelOf = (v: string) => BOARD_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function WinningBoard({ clientId, images, viewer }: {
  clientId: string; images: BoardImage[]; viewer: 'producer' | 'client';
}) {
  const [state, action] = useActionState<BoardResult | null, FormData>(uploadBoardImage, null);
  const [filter, setFilter] = useState<string>('all');
  const c = appCopy.board;

  /* Only offer a filter for a category that actually has something in it,
     so the row never promises a view that turns out empty. */
  const used = BOARD_CATEGORIES.filter((cat) => images.some((i) => i.category === cat.value));
  const shown = filter === 'all' ? images : images.filter((i) => i.category === filter);

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-light text-ink">🏆 {c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{viewer === 'client' ? c.subClient : c.subProducer}</p>

      {viewer === 'client' && (
        <form action={action} className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr_150px_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          <input
            name="image" type="file" required accept="image/*"
            className="text-[14px] file:mr-0 file:ml-3 file:rounded-none file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white"
            aria-label={c.upload}
          />
          <input name="caption" placeholder={c.captionPh} autoComplete="off" className="field" aria-label={c.caption} />
          <select name="category" defaultValue="other" className="field" aria-label={c.category}>
            {BOARD_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>
          <Upload />
        </form>
      )}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-none border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{viewer === 'client' ? c.none : c.noneProducer}</p>
      ) : (
        <>
          {used.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {[{ value: 'all', label: c.all }, ...used].map((cat) => (
                <button
                  key={cat.value} type="button" onClick={() => setFilter(cat.value)}
                  aria-pressed={filter === cat.value}
                  className={`rounded-none px-4 py-1.5 text-[13.5px] transition ${
                    filter === cat.value ? 'bg-ink text-white' : 'border border-line bg-white/70 text-ink-soft hover:bg-white'
                  }`}
                >{cat.label}</button>
              ))}
            </div>
          )}

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((img) => (
              <li key={img.id} className="overflow-hidden rounded-none border border-line bg-white">
                {/* a plain img: these are signed one-off URLs, not a fixed asset path */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption || labelOf(img.category)} className="h-52 w-full object-cover" loading="lazy" />
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    {img.caption && <p className="text-[14px] text-ink">{img.caption}</p>}
                    <p className="text-[12.5px] text-ink-mute">{labelOf(img.category)}</p>
                  </div>
                  {viewer === 'client' && (
                    <form action={deleteBoardImage}>
                      <input type="hidden" name="image_id" value={img.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
