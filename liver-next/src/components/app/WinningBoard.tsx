'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadBoardImage, deleteBoardImage, type BoardResult } from '@/app/actions/board';
import { ImagePlus } from 'lucide-react';
import { BOARD_CATEGORIES } from '@/content/lists';
import { useCopy } from '@/components/app/CopyProvider';

export type BoardImage = {
  id: string; category: string; caption: string; url: string;
};

function Upload() {
  const c = useCopy().board;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? c.uploading : c.upload}
    </button>
  );
}

const labelOf = (v: string) => BOARD_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function WinningBoard({ clientId, images, viewer }: {
  clientId: string; images: BoardImage[]; viewer: 'producer' | 'client';
}) {
  const [state, action] = useActionState<BoardResult | null, FormData>(uploadBoardImage, null);
  const [filter, setFilter] = useState<string>('all');
  const [picked, setPicked] = useState('');
  const c = useCopy().board;

  /* React resets the form's own fields after a successful action; the chip
     text lives in state and has to be told. */
  useEffect(() => { if (state?.ok) setPicked(''); }, [state]);

  /* Only offer a filter for a category that actually has something in it,
     so the row never promises a view that turns out empty. */
  const used = BOARD_CATEGORIES.filter((cat) => images.some((i) => i.category === cat.value));
  const shown = filter === 'all' ? images : images.filter((i) => i.category === filter);

  return (
    /* The one dark screen in the product.
     *
     * Everything else sits on ivory. This inverts, and the inversion is the
     * point: a moodboard is the only screen here where the pictures are the
     * content and the interface is meant to disappear behind them. A warm
     * near-black does that; a light ground competes with every tile on it.
     *
     * The whole block carries its own token overrides rather than a second
     * palette, so a producer's accent still reaches it and the gold that reads
     * 2.89:1 on ivory reads 6.32:1 here, which is why gold may carry words on
     * this screen and nowhere else. */
    <section
      className="border-t border-line bg-dark p-5 text-ink sm:p-8"
      style={{
        /* Channels, not hex. The classes below resolve through `--ink-rgb`,
           not through `--ink`, so an override written the old way was read by
           nothing and the whole screen quietly fell back to the light
           palette: near-black text on a near-black ground.

           The two soft tones were `rgba(250,247,242,.78)` and `.6` over this
           ground. They are written flattened rather than translucent because
           a channel triplet has no room for an alpha, and flattening over a
           known ground is what the browser was computing anyway. The contrast
           script derives the same two numbers the same way. */
        '--ink-rgb': '250 247 242',
        '--ink-soft-rgb': '198 195 191',   /* was #FAF7F2 at .78 */
        '--ink-mute-rgb': '156 153 149',   /* was #FAF7F2 at .60 */
        '--line': 'rgba(250,247,242,.12)',
        '--line-strong': 'rgba(250,247,242,.22)',
        '--line-control': 'rgba(250,247,242,.45)',
        /* Without this the inputs on this band were a light grey box with
           near-white text in it. The audit measured 1.44:1. */
        '--field-bg': 'rgba(250,247,242,.10)',
        '--surface-rgb': '14 12 10',
        '--surface-100-rgb': '21 17 14',
        '--surface-200-rgb': '42 36 29',
        '--accent-rgb': 'var(--accent-light-rgb, 223 196 155)',
        '--accent-bright-rgb': 'var(--accent-light-rgb, 223 196 155)',
      } as React.CSSProperties}
    >
      <p className="text-[11.5px] tracking-[.14em] text-accent-light">{c.eyebrow}</p>
      <h2 className="mt-2 font-display text-[30px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-2 text-[14.5px] text-ink-soft">{viewer === 'client' ? c.subClient : c.subProducer}</p>
      <hr className="rule-gold mt-6" />

      {viewer === 'client' && (
        <form action={action} className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr_150px_auto]">
          <input type="hidden" name="client_id" value={clientId} />
          {/* The native control said "Choose File" and "No file chosen" in
              the browser's own language, in English, in the middle of a
              Hebrew screen, and no amount of `file:` styling reaches that
              second string. The input is still here and still submits with
              the form; it is simply visually replaced by a label that shows
              the chosen name, in the language of the page. */}
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl2 border border-line-strong bg-surface-100 px-4 text-[14px] text-ink transition hover:border-accent/40 sm:min-h-0 sm:py-2">
            <ImagePlus size={16} aria-hidden strokeWidth={1.5} />
            <span className="max-w-[14rem] truncate">{picked || c.choose}</span>
            <input
              name="image" type="file" required accept="image/*" className="sr-only"
              aria-label={c.upload}
              onChange={(e) => setPicked(e.target.files?.[0]?.name ?? '')}
            />
          </label>
          <input name="caption" placeholder={c.captionPh} autoComplete="off" className="field" aria-label={c.caption} />
          <select name="category" defaultValue="other" className="field" aria-label={c.category}>
            {BOARD_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>
          <Upload />
        </form>
      )}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
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
                  className={`inline-flex min-h-[44px] items-center rounded-xl2 px-4 text-[13.5px] transition sm:min-h-0 sm:py-1.5 ${
                    filter === cat.value ? 'bg-ink text-surface' : 'border border-line bg-surface-100 text-ink-soft hover:bg-surface-200'
                  }`}
                >{cat.label}</button>
              ))}
            </div>
          )}

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((img) => (
              <li key={img.id} className="overflow-hidden rounded-xl2 border border-line bg-surface-100">
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
