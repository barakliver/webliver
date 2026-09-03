'use client';

import { useActionState, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { appCopy } from '@/content/site';
import { ACCENTS, accentByKey, accentVars } from '@/content/brand';
import { saveBrand, type BrandResult } from '@/app/actions/brand';
import { cn } from '@/lib/utils';

const c = appCopy.brand;

export type BrandFields = {
  brandName: string;
  tagline: string;
  accent: string;
  whatsapp: string;
  bookingUrl: string;
  slug: string | null;
  domain: string | null;
  logoUrl: string | null;
};

/**
 * A producer setting up how their business looks.
 *
 * The accent is a shortlist rather than a colour picker, and the swatches say
 * why by showing the whole set at once: each one is four worked-out tones, not
 * a hue. A free hex field would let somebody choose a yellow that makes their
 * own couples' text unreadable, and neither of them would find out by looking
 * at it.
 *
 * The preview is live and sits above the fold, because a colour choice made
 * from six circles is a guess and a colour choice made from a rendered header
 * is a decision.
 */
export function BrandEditor({ fields, rootDomain }: { fields: BrandFields; rootDomain: string }) {
  const [state, action, pending] = useActionState<BrandResult | null, FormData>(saveBrand, null);
  const [accent, setAccent] = useState(fields.accent);
  const [name, setName] = useState(fields.brandName);
  const [tagline, setTagline] = useState(fields.tagline);

  /* The short name in the address, held here so the screen can answer while
     it is typed. The browser's own answer to a dot in this field is "match
     the requested format", which tells nobody what the format is; a producer
     typed their whole domain into it and was stuck. So the field says what
     it takes, shows the address it will become, and when the value carries a
     character it cannot, offers the nearest one that works. */
  const [slug, setSlug] = useState(fields.slug ?? '');
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const SLUG_OK = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
  const cleaned = slug.trim().toLowerCase();
  const suggestion = cleaned
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 32);
  const slugState: 'empty' | 'ok' | 'short' | 'bad' =
    cleaned === '' ? 'empty'
    : SLUG_OK.test(cleaned) ? 'ok'
    : suggestion.length < 3 ? 'short'
    : 'bad';

  const chosen = accentByKey(accent);

  return (
    <form action={action} className="space-y-5">
      {/* ── what it will look like ─────────────────────────────────────── */}
      <section className="card" style={accentVars(chosen) as React.CSSProperties}>
        <div className="text-[12.5px] font-semibold text-ink-mute">{c.preview}</div>
        <div className="mt-3 rounded-xl2 border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <span className="font-display text-[17px] font-semibold text-ink">
              {name || c.namePh}
            </span>
            <span className="chip" style={{ borderColor: chosen.line, color: chosen.base }}>
              {appCopy.nav.overview}
            </span>
          </div>
          <p className="mt-3 text-[14px] text-ink-soft">{tagline || c.taglinePh}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex min-h-[36px] items-center rounded-xl2 px-4 text-[13.5px] font-medium text-surface"
              style={{ background: chosen.base }}
            >
              {appCopy.brand.save}
            </span>
            <span
              className="inline-flex min-h-[36px] items-center rounded-xl2 border px-4 text-[13.5px]"
              style={{ borderColor: chosen.line, color: chosen.base }}
            >
              {appCopy.nav.clients}
            </span>
          </div>
        </div>
      </section>

      {/* ── who you are ────────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <div>
          <label className="label" htmlFor="brand_name">{c.name}</label>
          <input
            id="brand_name" name="brand_name" className="field"
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder={c.namePh} maxLength={80}
          />
        </div>

        <div>
          <label className="label" htmlFor="tagline">{c.tagline}</label>
          <input
            id="tagline" name="tagline" className="field"
            value={tagline} onChange={(e) => setTagline(e.target.value)}
            placeholder={c.taglinePh} maxLength={120}
          />
        </div>

        <fieldset>
          <legend className="label">{c.accent}</legend>
          <input type="hidden" name="accent" value={accent} />
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAccent(a.key)}
                aria-pressed={a.key === accent}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-2 rounded-xl2 border px-3.5 text-[13.5px] font-medium transition-colors',
                  a.key === accent ? 'border-ink text-ink' : 'border-line text-ink-soft hover:border-line-strong',
                )}
              >
                <span
                  aria-hidden
                  className="grid h-5 w-5 place-items-center rounded-full"
                  style={{ background: a.base }}
                >
                  {a.key === accent && <Check size={12} strokeWidth={1.5} color="#fff" />}
                </span>
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-mute">{c.accentHint}</p>
        </fieldset>
      </section>

      {/* ── how people reach you ───────────────────────────────────────── */}
      <section className="card space-y-4">
        <div>
          <label className="label" htmlFor="whatsapp">{c.whatsapp}</label>
          <input id="whatsapp" name="whatsapp" className="field" dir="ltr"
                 defaultValue={fields.whatsapp} maxLength={40} />
        </div>
        <div>
          <label className="label" htmlFor="booking_url">{c.booking}</label>
          <input id="booking_url" name="booking_url" className="field" dir="ltr"
                 defaultValue={fields.bookingUrl} maxLength={300} />
        </div>
      </section>

      {/* ── your address ───────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="font-display text-[17px] font-semibold text-ink">{c.address}</h2>

        <div>
          <label className="label" htmlFor="slug">{c.slug}</label>
          <input
            id="slug" name="slug" className="field" dir="ltr"
            value={slug} onChange={(e) => setSlug(e.target.value)}
            maxLength={32} autoComplete="off" spellCheck={false}
            placeholder="eden-haimov"
            aria-describedby="slug-hint"
            aria-invalid={slugState === 'bad' || slugState === 'short' ? true : undefined}
          />
          <p id="slug-hint" className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{c.slugHint}</p>

          {slugState === 'ok' && (
            <p className="mt-2 text-[13px] text-ink-soft">
              {c.slugPreview}{' '}
              <span dir="ltr" className="font-mono text-[12.5px] text-ink">{`${origin || ''}/p/${cleaned}`}</span>
              {rootDomain && (
                <>
                  {' · '}
                  <span dir="ltr" className="font-mono text-[12.5px] text-ink">{`${cleaned}.${rootDomain}`}</span>
                </>
              )}
            </p>
          )}
          {slugState === 'bad' && (
            <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-bad">
              {c.slugBad}
              <span dir="ltr" className="font-mono text-[12.5px] text-ink">{suggestion}</span>
              <button
                type="button"
                onClick={() => setSlug(suggestion)}
                className="btn-quiet min-h-[36px] px-2 text-[13px]"
              >
                {c.slugUse}
              </button>
            </p>
          )}
          {slugState === 'short' && (
            <p role="alert" className="mt-2 text-[13px] text-bad">{c.slugShort}</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="domain">{c.domain}</label>
          <input id="domain" name="domain" className="field" dir="ltr"
                 defaultValue={fields.domain ?? ''} maxLength={253} />
          <p className="mt-1 text-[12.5px] text-ink-mute">{c.domainHint}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? c.saving : c.save}
        </button>
        {state?.ok && <span className="text-[14px] text-ok">{c.saved}</span>}
        {state?.error && <span className="text-[14px] text-bad">{state.error}</span>}
      </div>
    </form>
  );
}
