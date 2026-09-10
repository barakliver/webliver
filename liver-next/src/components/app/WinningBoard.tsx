'use client';

import { useRef, useState } from 'react';
import { registerBoardImage, deleteBoardImage } from '@/app/actions/board';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ImagePlus } from 'lucide-react';
import { BOARD_CATEGORIES } from '@/content/lists';
import { useCopy } from '@/components/app/CopyProvider';

export type BoardImage = {
  id: string; category: string; caption: string; url: string;
};

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const labelOf = (v: string) => BOARD_CATEGORIES.find((c) => c.value === v)?.label ?? v;

const extensionFor = (type: string, name: string): string => {
  const fromName = (name.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1] ?? '').toLowerCase();
  if (fromName) return fromName;
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
};

const plural = (c: { one: string; many: string }, n: number) => (n === 1 ? c.one : c.many.replace('{n}', String(n)));

export function WinningBoard({ clientId, images, viewer }: {
  clientId: string; images: BoardImage[]; viewer: 'producer' | 'client';
}) {
  const [filter, setFilter] = useState<string>('all');
  const [chosen, setChosen] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('other');
  const [progress, setProgress] = useState<{ n: number; m: number } | null>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const c = useCopy().board;

  /* Only offer a filter for a category that actually has something in it,
     so the row never promises a view that turns out empty. */
  const used = BOARD_CATEGORIES.filter((cat) => images.some((i) => i.category === cat.value));
  const shown = filter === 'all' ? images : images.filter((i) => i.category === filter);

  /* Several at once, each straight from the browser to storage under this
     session, then one row per photograph. A server action carries a request
     body, and a request body has a ceiling of a few megabytes: one camera
     photograph is past it and eight are far past it, which is why the old
     one-at-a-time form went quiet on exactly the pictures a board is for. */
  const send = async (list: File[]) => {
    if (list.length === 0) return;
    setError('');
    const sb = supabaseBrowser();
    let failed = 0;
    let why = '';
    for (const [i, file] of list.entries()) {
      setProgress({ n: i + 1, m: list.length });
      if (file.size > MAX_BYTES) { failed++; why = c.tooBig; continue; }
      const type = file.type || 'image/jpeg';
      if (!ALLOWED.includes(type)) { failed++; continue; }
      const path = `${clientId}/${crypto.randomUUID()}.${extensionFor(type, file.name)}`;
      const { error: upErr } = await sb.storage.from('moodboards').upload(path, file, { contentType: type, upsert: false });
      if (upErr) { failed++; continue; }
      const res = await registerBoardImage({ clientId, path, caption, category });
      if (!res.ok) { failed++; why = res.error ?? ''; }
    }
    setProgress(null);
    setChosen([]);
    if (input.current) input.current.value = '';
    if (failed > 0) setError([plural(c.failedSome, failed), why].filter(Boolean).join('. '));
    else setCaption('');
  };

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
      <p className="mt-2 text-[14.5px] text-ink-soft">{viewer === 'client' ? c.subClient : c.subProducerAdd}</p>
      <hr className="rule-gold mt-6" />

      {/* Both sides add. The couple is who the board is for; the producer
          adds when the couple sent the pictures on WhatsApp, which is where
          they actually arrive. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setOver(false);
          if (e.dataTransfer.files?.length) void send(Array.from(e.dataTransfer.files));
        }}
        className={`mt-5 rounded-xl2 border border-dashed p-4 transition ${over ? 'border-accent bg-surface-200' : 'border-line-strong'}`}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); void send(chosen); }}
          className="grid gap-3 sm:grid-cols-[auto_1fr_150px_auto]"
        >
          {/* The native control said "Choose File" and "No file chosen" in
              the browser's own language, in English, in the middle of a
              Hebrew screen, and no amount of `file:` styling reaches that
              second string. The input is still here and still submits with
              the form; it is simply visually replaced by a label that shows
              what was chosen, in the language of the page. */}
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl2 border border-line-strong bg-surface-100 px-4 text-[14px] text-ink transition hover:border-accent/40 sm:min-h-0 sm:py-2">
            <ImagePlus size={16} aria-hidden strokeWidth={1.5} />
            <span className="max-w-[16rem] truncate">
              {chosen.length === 0 ? c.chooseMany : chosen.length === 1 ? chosen[0].name : plural(c.picked, chosen.length)}
            </span>
            <input
              ref={input} type="file" multiple accept="image/*" className="sr-only"
              aria-label={c.chooseMany}
              onChange={(e) => setChosen(Array.from(e.target.files ?? []))}
            />
          </label>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={c.captionPh} autoComplete="off" className="field" aria-label={c.caption} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field" aria-label={c.category}>
            {BOARD_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={progress !== null || chosen.length === 0}>
            {progress ? c.progress.replace('{n}', String(progress.n)).replace('{m}', String(progress.m)) : c.upload}
          </button>
        </form>
        <p className="mt-2 text-[12.5px] text-ink-mute">{c.dropHint}</p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {error}
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
                  <form action={deleteBoardImage}>
                    <input type="hidden" name="image_id" value={img.id} />
                    <input type="hidden" name="client_id" value={clientId} />
                    <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
