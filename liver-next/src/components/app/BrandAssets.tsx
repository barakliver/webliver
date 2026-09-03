'use client';

import { useActionState, useRef, useState } from 'react';
import { Check, ImageIcon, Smartphone, Sparkles, Trash2, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { appCopy } from '@/content/site';
import { uploadBrandAsset, removeBrandAsset, type BrandAsset, type BrandResult } from '@/app/actions/brand';
import { cn } from '@/lib/utils';

const c = appCopy.brand.assets;

export type BrandAssetUrls = { logo: string | null; icon: string | null; cover: string | null };

/** What the screen refuses before the server does, and the same numbers the
 *  rules under each button state. */
const LIMITS: Record<BrandAsset, { max: number; accept: string; types: string[] }> = {
  logo:  { max: 2 * 1024 * 1024, accept: 'image/png,image/svg+xml,image/webp', types: ['image/png', 'image/svg+xml', 'image/webp'] },
  icon:  { max: 1 * 1024 * 1024, accept: 'image/png', types: ['image/png'] },
  cover: { max: 5 * 1024 * 1024, accept: 'image/jpeg,image/webp,image/png', types: ['image/jpeg', 'image/webp', 'image/png'] },
};

const ICONS: Record<BrandAsset, LucideIcon> = { logo: Sparkles, icon: Smartphone, cover: ImageIcon };

/**
 * The three pictures a brand is made of, each with its rules beside it.
 *
 * The rules are not a help page. They sit next to the button because the
 * mistakes are always the same ones: a logo saved as a JPG with a white box
 * round it, an icon with a transparent margin that iOS fills in black, a
 * cover with the business name typed across it that the share card then
 * crops through the middle. Told once, at the moment of choosing, nobody
 * makes them twice.
 *
 * Each picture is its own form, so replacing the cover never touches the
 * logo, and the upload starts the moment a file is chosen: a second button
 * to press after the first is the step people forget.
 */
export function BrandAssets({ urls }: { urls: BrandAssetUrls }) {
  return (
    <section className="card">
      <h2 className="font-display text-[17px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Asset kind="logo" url={urls.logo} />
        <Asset kind="icon" url={urls.icon} />
        <Asset kind="cover" url={urls.cover} />
      </div>
    </section>
  );
}

function Asset({ kind, url }: { kind: BrandAsset; url: string | null }) {
  const rule = c[kind];
  const limit = LIMITS[kind];
  const Icon = ICONS[kind];
  const input = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [local, setLocal] = useState('');
  const [state, action, pending] = useActionState<BrandResult | null, FormData>(uploadBrandAsset, null);

  /* Refused here, in words, before a minute is spent uploading something the
     server will refuse in the same words. */
  const choose = (file: File | undefined) => {
    if (!file) return;
    if (file.size > limit.max) { setLocal(c.tooBig); return; }
    if (!limit.types.includes(file.type)) { setLocal(c.badType); return; }
    setLocal('');
    formRef.current?.requestSubmit();
  };

  const error = local || (state && !state.ok ? state.error : '');

  return (
    <div className="flex flex-col rounded-xl2 border border-line bg-surface-100 p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} strokeWidth={1.5} aria-hidden className="text-accent" />
        <h3 className="text-[14.5px] font-medium text-ink">{rule.title}</h3>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">{rule.where}</p>

      {/* The picture as it is, on the ground it will actually sit on: the
          icon on a phone-shaped tile, the cover wide, the logo on the page. */}
      <div
        className={cn(
          'mt-3 grid place-items-center overflow-hidden rounded-xl2 border border-line bg-card',
          kind === 'cover' ? 'aspect-video' : 'h-28',
        )}
      >
        {url ? (
          kind === 'icon' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={rule.title} className="size-16 rounded-[18px] object-cover shadow-pop" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={rule.title} className={cn('object-contain', kind === 'cover' ? 'size-full object-cover' : 'max-h-16 max-w-[80%]')} />
          )
        ) : (
          <span className="text-[12.5px] text-ink-mute">{c.empty}</span>
        )}
      </div>

      <ul className="mt-3 space-y-1 text-[12.5px] text-ink-soft">
        {rule.rules.map((r) => (
          <li key={r} className="flex items-start gap-1.5">
            <Check size={13} strokeWidth={1.5} aria-hidden className="mt-[3px] shrink-0 text-accent" />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <form ref={formRef} action={action}>
          <input type="hidden" name="kind" value={kind} />
          <input
            ref={input} type="file" name="file" accept={limit.accept} className="sr-only"
            aria-label={`${rule.title}: ${url ? c.replace : c.choose}`}
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <button
            type="button" onClick={() => input.current?.click()} disabled={pending}
            className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]"
          >
            <Upload size={14} strokeWidth={1.5} aria-hidden />
            {pending ? c.uploading : url ? c.replace : c.choose}
          </button>
        </form>
        {url && !pending && (
          <form action={removeBrandAsset}>
            <input type="hidden" name="kind" value={kind} />
            <button type="submit" className="btn-quiet inline-flex min-h-[38px] items-center gap-1.5 px-2 text-[13px]">
              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              {c.remove}
            </button>
          </form>
        )}
        {state?.ok && !pending && !local && (
          <span className="inline-flex items-center gap-1 text-[13px] text-ok">
            <Check size={14} strokeWidth={1.5} aria-hidden />
            {c.uploaded}
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
