'use client';

import { useActionState, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Scissors, Share2, Trash2, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { addVip, removeVip, addLook, removeLook, mintShare, revokeShare, type PrepResult } from '@/app/actions/prep';

/**
 * The two things a supplier needs and a conversation never carries reliably.
 *
 * A face. "Don't miss grandma" is the most common instruction a photographer
 * is given, and it arrives as a sentence about a room of two hundred people,
 * addressed to somebody who has never met her. A photograph and a name settle
 * it, and nothing else does.
 *
 * A look. Hair, makeup and outfit references live in a camera roll and reach
 * the stylist as a screenshot of a screenshot. Here they sit on the event,
 * next to the schedule that says when the stylist arrives.
 *
 * Both sides own this panel. The couple knows who the aunt is; the producer
 * knows what the photographer needs. There is nothing to negotiate between
 * them, so there is one panel and not two.
 *
 * Pure of any data source, like the other documents in here — it is handed
 * rows and signed urls and renders them — which is what makes it possible to
 * look at without an account, a network and somebody's real wedding.
 */

export type Vip = {
  id: string; name: string; relation: string; note: string;
  /** Already signed by the server. The bucket is private. */
  url: string | null;
};

export type Look = {
  id: string; category: 'hair' | 'makeup' | 'outfit' | 'other'; note: string; url: string | null;
};

export type Share = {
  id: string; token: string; scope: 'all' | 'faces' | 'looks'; label: string;
  expiresAt: string | null; revokedAt: string | null;
};

export type PrepCopy = {
  facesTitle: string; facesSub: string; facesEmpty: string;
  name: string; relation: string; relationPh: string; note: string; notePh: string;
  photo: string; add: string; adding: string; remove: string;
  looksTitle: string; looksSub: string; looksEmpty: string; kind: string;
  categories: { hair: string; makeup: string; outfit: string; other: string };
  shareTitle: string; shareSub: string; shareAll: string; shareFaces: string; shareLooks: string;
  shareNew: string; shareCopy: string; shareCopied: string; shareRevoke: string;
  shareNone: string; shareUntil: string; uploadFailed: string; tooBig: string;
};

const MAX_BYTES = 8 * 1024 * 1024;
const ORDER = ['hair', 'makeup', 'outfit', 'other'] as const;

export function PrepSheet({ c, clientId, vips, looks, shares, siteUrl }: {
  c: PrepCopy;
  clientId: string;
  vips: Vip[];
  looks: Look[];
  shares: Share[];
  /** For building a link somebody can read out. */
  siteUrl: string;
}) {
  return (
    <div className="space-y-6">
      <Faces c={c} clientId={clientId} vips={vips} />
      <Looks c={c} clientId={clientId} looks={looks} />
      <Shares c={c} clientId={clientId} shares={shares} siteUrl={siteUrl} />
    </div>
  );
}

/**
 * Uploading a picture, which every panel here does the same way.
 *
 * Straight into storage from the browser, as everything else on an event is:
 * a server action would be refused by the framework at one megabyte, silently,
 * before it ran. Only the path travels to the action afterwards.
 */
function usePhoto(clientId: string, c: PrepCopy) {
  const [path, setPath] = useState('');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > MAX_BYTES) { setError(c.tooBig); return; }
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
    /* The event first, because that is the segment the storage policy reads
       to decide who may write here. */
    const key = `${clientId}/${crypto.randomUUID()}.${ext || 'jpg'}`;
    const { error: up } = await supabaseBrowser().storage.from('files')
      .upload(key, file, { contentType: file.type || 'image/jpeg', upsert: false });
    setBusy(false);
    if (up) { setError(c.uploadFailed); return; }
    setPath(key);
    setPreview(URL.createObjectURL(file));
  };

  const clear = () => {
    setPath(''); setPreview(''); setError('');
    if (input.current) input.current.value = '';
  };

  return { path, preview, busy, error, input, pick, clear };
}

function Faces({ c, clientId, vips }: { c: PrepCopy; clientId: string; vips: Vip[] }) {
  const [state, action, pending] = useActionState<PrepResult | null, FormData>(addVip, null);
  const photo = usePhoto(clientId, c);

  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-semibold text-ink">{c.facesTitle}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.facesSub}</p>

      {vips.length === 0 ? (
        <p className="mt-4 text-[14.5px] text-ink-mute">{c.facesEmpty}</p>
      ) : (
        <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {vips.map((v) => (
            <li key={v.id} className="flex items-start gap-3 rounded-xl2 border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.url
                ? <img src={v.url} alt={v.name} className="size-16 shrink-0 rounded-xl2 object-cover" />
                : <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-xl2 bg-surface-200 text-ink-mute">
                    <Camera size={18} strokeWidth={1.5} />
                  </span>}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-ink">{v.name}</p>
                {v.relation && <p className="text-[13px] text-ink-soft">{v.relation}</p>}
                {v.note && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-mute">{v.note}</p>}
              </div>
              <form action={removeVip}>
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button type="submit" aria-label={c.remove}
                  className="rounded-xl2 p-1.5 text-ink-mute transition hover:bg-bad-wash hover:text-bad">
                  <Trash2 size={15} strokeWidth={1.5} aria-hidden />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-5 border-t border-line pt-4">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="photo_url" value={photo.path} />

        <div className="flex flex-wrap items-end gap-3">
          <PhotoButton c={c} photo={photo} />
          <label className="min-w-[9rem] flex-1">
            <span className="label">{c.name}</span>
            <input name="name" required maxLength={80} className="field mt-1 w-full" />
          </label>
          <label className="min-w-[9rem] flex-1">
            <span className="label">{c.relation}</span>
            <input name="relation" maxLength={60} placeholder={c.relationPh} className="field mt-1 w-full" />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="label">{c.note}</span>
          <input name="note" maxLength={400} placeholder={c.notePh} className="field mt-1 w-full" />
        </label>

        <Submit c={c} pending={pending} />
        {state?.ok === false && state.error && <Err text={state.error} />}
        {photo.error && <Err text={photo.error} />}
      </form>
    </section>
  );
}

function Looks({ c, clientId, looks }: { c: PrepCopy; clientId: string; looks: Look[] }) {
  const [state, action, pending] = useActionState<PrepResult | null, FormData>(addLook, null);
  const photo = usePhoto(clientId, c);

  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-semibold text-ink">{c.looksTitle}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.looksSub}</p>

      {looks.length === 0 ? (
        <p className="mt-4 text-[14.5px] text-ink-mute">{c.looksEmpty}</p>
      ) : (
        /* Grouped by what it is, because a stylist opens this looking for one
           of the three and scrolling past the other two is the whole
           annoyance of a camera roll. */
        ORDER.filter((cat) => looks.some((l) => l.category === cat)).map((cat) => (
          <div key={cat} className="mt-4">
            <h3 className="eyebrow">{c.categories[cat]}</h3>
            {/* A contact sheet, not a row of cards. These are scanned — a
                stylist looks at eight of them at once and picks — and at four
                to a row a category with one picture in it reads as a mistake
                rather than as one picture. */}
            <ul className="mt-2 grid list-none gap-2 p-0 grid-cols-3 sm:grid-cols-5 lg:grid-cols-7">
              {looks.filter((l) => l.category === cat).map((l) => (
                <li key={l.id} className="group relative overflow-hidden rounded-xl2 border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.url && <img src={l.url} alt={l.note || c.categories[cat]} className="aspect-square w-full object-cover" />}
                  {l.note && <p className="px-1.5 py-1 text-[11.5px] leading-snug text-ink-soft">{l.note}</p>}
                  <form action={removeLook} className="absolute end-1.5 top-1.5">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="client_id" value={clientId} />
                    <button type="submit" aria-label={c.remove}
                      className="grid size-6 place-items-center rounded-full bg-surface/85 text-ink-mute transition hover:text-bad">
                      <X size={12} strokeWidth={1.5} aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <form action={action} className="mt-5 border-t border-line pt-4">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="image_url" value={photo.path} />
        <div className="flex flex-wrap items-end gap-3">
          <PhotoButton c={c} photo={photo} icon={Scissors} />
          <label className="min-w-[8rem]">
            <span className="label">{c.kind}</span>
            <select name="category" defaultValue="hair" className="field mt-1">
              {ORDER.map((cat) => <option key={cat} value={cat}>{c.categories[cat]}</option>)}
            </select>
          </label>
          <label className="min-w-[10rem] flex-1">
            <span className="label">{c.note}</span>
            <input name="note" maxLength={400} className="field mt-1 w-full" />
          </label>
        </div>
        <Submit c={c} pending={pending} disabled={!photo.path} />
        {state?.ok === false && state.error && <Err text={state.error} />}
        {photo.error && <Err text={photo.error} />}
      </form>
    </section>
  );
}

function Shares({ c, clientId, shares, siteUrl }: {
  c: PrepCopy; clientId: string; shares: Share[]; siteUrl: string;
}) {
  const [copied, setCopied] = useState('');
  const live = shares.filter((s) => !s.revokedAt);

  const label = (s: Share['scope']) =>
    s === 'faces' ? c.shareFaces : s === 'looks' ? c.shareLooks : c.shareAll;

  return (
    <section className="card">
      <h2 className="inline-flex items-center gap-2 font-display text-[19px] font-semibold text-ink">
        <Share2 size={17} strokeWidth={1.5} aria-hidden />
        {c.shareTitle}
      </h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.shareSub}</p>

      {live.length === 0 ? (
        <p className="mt-4 text-[14.5px] text-ink-mute">{c.shareNone}</p>
      ) : (
        <ul className="mt-4 list-none space-y-2 p-0">
          {live.map((s) => {
            const url = `${siteUrl}/prep/${s.token}`;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl2 border border-line p-3">
                <span className="chip-mute">{label(s.scope)}</span>
                {s.label && <span className="text-[13.5px] text-ink">{s.label}</span>}
                {s.expiresAt && (
                  <span className="text-[12.5px] text-ink-mute">
                    {c.shareUntil} {s.expiresAt.slice(0, 10)}
                  </span>
                )}
                <span className="flex-1" />
                <button type="button" onClick={() => {
                  void navigator.clipboard.writeText(url).then(() => {
                    setCopied(s.id); setTimeout(() => setCopied(''), 1400);
                  }).catch(() => { /* the link is on screen; selecting it still works */ });
                }} className="btn-ghost min-h-[34px] px-3 text-[13px]">
                  {copied === s.id ? c.shareCopied : c.shareCopy}
                </button>
                <form action={revokeShare}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <button type="submit" className="btn-quiet min-h-[34px] px-3 text-[13px]">{c.shareRevoke}</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {/* Three links rather than one, because a photographer has no business
          in somebody's makeup references and a stylist has none in a family
          roster — and the link that opens everything is the one that gets
          forwarded to a third person. */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {(['faces', 'looks', 'all'] as const).map((scope) => (
          <form key={scope} action={mintShare}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="scope" value={scope} />
            <button type="submit" className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]">
              <Plus size={15} strokeWidth={1.5} aria-hidden />
              {c.shareNew} · {label(scope)}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

/* ── the small shared pieces ─────────────────────────────────────────────── */

function PhotoButton({ c, photo, icon: Icon = Camera }: {
  c: PrepCopy;
  photo: ReturnType<typeof usePhoto>;
  icon?: typeof Camera;
}) {
  return (
    <div className="shrink-0">
      <input
        ref={photo.input} type="file" accept="image/*" className="sr-only" id={`photo-${Icon.name}`}
        onChange={(e) => void photo.pick(e.target.files?.[0])}
      />
      <label
        htmlFor={`photo-${Icon.name}`}
        className="grid size-16 cursor-pointer place-items-center overflow-hidden rounded-xl2 border border-dashed border-line-strong text-ink-mute transition hover:border-accent/50 hover:text-accent"
      >
        {photo.busy ? <Loader2 size={18} strokeWidth={1.5} aria-hidden className="animate-spin" />
          : photo.preview
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={photo.preview} alt="" className="size-full object-cover" />
            : <Icon size={18} strokeWidth={1.5} aria-hidden />}
        <span className="sr-only">{c.photo}</span>
      </label>
    </div>
  );
}

function Submit({ c, pending, disabled = false }: { c: PrepCopy; pending: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary mt-3 px-4 text-[14px]">
      {pending
        ? <Loader2 size={15} strokeWidth={1.5} aria-hidden className="animate-spin" />
        : <Plus size={15} strokeWidth={1.5} aria-hidden />}
      {pending ? c.adding : c.add}
    </button>
  );
}

function Err({ text }: { text: string }) {
  return <p role="status" className="mt-2 text-[13.5px] text-bad">{text}</p>;
}
