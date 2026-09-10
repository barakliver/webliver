'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Sparkles, Pipette, Printer, ExternalLink } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { saveWeddingBrand, pickBrandVariant, type WeddingBrandResult } from '@/app/actions/weddingBrand';
import { Piece, Mock, type PieceData } from '@/components/brand/Pieces';
import { paletteFrom } from '@/lib/palette';
import {
  FONT_PAIRS, PALETTE_ROLES, PIECES, defaultBrand, fontHref, fontPair, readBrand, variantFor,
  type PieceKey, type Variant, type WeddingBrand,
} from '@/content/brandKit';

/**
 * The creative director's desk, on the event.
 *
 * Above the fold, what the producer types before the reading; then one
 * button that reads the board; then the brand sheet as an editable form;
 * then the seven pieces, each in two options with a radio under each; then
 * where to print. The couple gets the same screen without the inputs, the
 * reading and the save: they see the sheet and they pick.
 *
 * Nothing is saved by the reading. The sheet comes back into the form and
 * the producer presses save; the picks go straight through, one press each,
 * because a pick is a decision and not a draft.
 */

type Props = {
  clientId: string;
  viewer: 'producer' | 'client';
  brand: WeddingBrand | null;
  /** Signed links to the board's photographs, for the in-browser reading. */
  images: string[];
  data: PieceData;
  /** Whether the server can read the board: the assistant's key is set. */
  canAi: boolean;
  printBase: string;
  siteUrl: string;
  /** Opened, with a sample sheet, for the harness. */
  demo?: boolean;
};

function SaveButton() {
  const c = useCopy().studio.sheet;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

/** The board's pixels, read in the browser: each photograph drawn small on
 *  a canvas, the pixels pooled, the palette taken from the pool. Signed
 *  storage links answer with the header a canvas needs; a link that does
 *  not (or a file that will not load) is skipped, and no image at all is
 *  the one error. */
async function samplePixels(urls: string[]): Promise<number[]> {
  const out: number[] = [];
  const canvas = document.createElement('canvas');
  const SIDE = 40;
  canvas.width = SIDE; canvas.height = SIDE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  for (const url of urls.slice(0, 15)) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('load'));
        el.src = url;
      });
      ctx.clearRect(0, 0, SIDE, SIDE);
      ctx.drawImage(img, 0, 0, SIDE, SIDE);
      const px = ctx.getImageData(0, 0, SIDE, SIDE).data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 128) continue;
        out.push(px[i], px[i + 1], px[i + 2]);
      }
    } catch { /* one photograph is not the board */ }
  }
  return out;
}

export function BrandStudio({ clientId, viewer, brand, images, data, canAi, printBase, siteUrl, demo = false }: Props) {
  const ui = useCopy();
  const c = ui.studio;
  const producer = viewer === 'producer';

  const [draft, setDraft] = useState<WeddingBrand>(() => brand ?? defaultBrand());
  const [busy, setBusy] = useState<'' | 'ai' | 'extract'>('');
  const [note, setNote] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(null);
  const [state, action] = useActionState<WeddingBrandResult | null, FormData>(saveWeddingBrand, null);
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);

  /* A pick made from the other side lands in the row and comes back as a
     new prop; the draft keeps its own edits and takes the picks. */
  useEffect(() => { if (brand) setDraft((d) => ({ ...d, picks: { ...d.picks, ...brand.picks } })); }, [brand]);

  const set = <K extends keyof WeddingBrand>(k: K, v: WeddingBrand[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setText = (k: keyof WeddingBrand['texts'], v: string) => setDraft((d) => ({ ...d, texts: { ...d.texts, [k]: v } }));
  const setInput = (k: keyof WeddingBrand['inputs'], v: string) => setDraft((d) => ({ ...d, inputs: { ...d.inputs, [k]: v } }));
  const setSwatch = (role: string, patch: { hex?: string; name?: string }) =>
    setDraft((d) => ({ ...d, palette: d.palette.map((s) => (s.role === role ? { ...s, ...patch, hex: (patch.hex ?? s.hex).toUpperCase() } : s)) }));

  /* A row holding only picks is not a sheet yet. */
  const hasBrand = !!brand?.by || demo;

  async function readBoard() {
    if (images.length === 0) { setNote({ tone: 'bad', text: c.readNone }); return; }
    setBusy('ai'); setNote(null);
    try {
      const res = await fetch('/api/brand', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, inputs: draft.inputs }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; brand?: unknown };
      if (!json.ok) {
        setNote({ tone: 'bad', text: json.error === 'nokey' ? c.readNoKey : json.error === 'noimages' ? c.readNone : (json.error || c.readFail) });
      } else {
        const b = readBrand(json.brand);
        if (b) setDraft((d) => ({ ...b, picks: { ...d.picks }, texts: d.texts.story || d.texts.travel || d.texts.menu ? d.texts : b.texts }));
      }
    } catch {
      setNote({ tone: 'bad', text: c.readFail });
    } finally { setBusy(''); }
  }

  async function extract() {
    if (images.length === 0) { setNote({ tone: 'bad', text: c.readNone }); return; }
    setBusy('extract'); setNote(null);
    try {
      const px = await samplePixels(images);
      if (px.length < 30) { setNote({ tone: 'bad', text: c.extractFail }); return; }
      const pal = paletteFrom(px);
      setDraft((d) => ({ ...d, palette: pal.map((s) => ({ ...s, name: d.palette.find((x) => x.role === s.role)?.name ?? '' })), by: d.by || 'hand' }));
    } catch {
      setNote({ tone: 'bad', text: c.extractFail });
    } finally { setBusy(''); }
  }

  const pair = fontPair(draft.fonts);
  const hrefs = useMemo(() => Array.from(new Set([fontHref(draft.fonts)])), [draft.fonts]);

  return (
    <section className="card">
      {hrefs.map((h) => <link key={h} rel="stylesheet" href={h} precedence="default" />)}
      <p className="eyebrow">{c.eyebrow}</p>
      <h2 className="mt-2 font-display text-[26px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">{producer ? c.sub : c.subClient}</p>

      {!producer && !hasBrand && <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>}

      {producer && (
        <div className="mt-6 rounded-xl2 border border-line bg-surface-100 p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-ink">{c.inputs.title}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[13px] text-ink-soft">{c.inputs.words}
              <input className="field" value={draft.inputs.words} onChange={(e) => setInput('words', e.target.value)} placeholder={c.inputs.wordsPh} /></label>
            <label className="grid gap-1 text-[13px] text-ink-soft">{c.inputs.reference}
              <input className="field" value={draft.inputs.reference} onChange={(e) => setInput('reference', e.target.value)} placeholder={c.inputs.referencePh} /></label>
            <label className="grid gap-1 text-[13px] text-ink-soft">{c.inputs.colorsIn}
              <input className="field" value={draft.inputs.colorsIn} onChange={(e) => setInput('colorsIn', e.target.value)} placeholder={c.inputs.colorsInPh} /></label>
            <label className="grid gap-1 text-[13px] text-ink-soft">{c.inputs.colorsOut}
              <input className="field" value={draft.inputs.colorsOut} onChange={(e) => setInput('colorsOut', e.target.value)} placeholder={c.inputs.colorsOutPh} /></label>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-mute">{c.inputs.pinterest}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={readBoard} disabled={busy !== '' || !canAi}>
              <Sparkles size={16} aria-hidden strokeWidth={1.5} />
              {busy === 'ai' ? c.reading : c.read}
            </button>
            <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={extract} disabled={busy !== ''}>
              <Pipette size={16} aria-hidden strokeWidth={1.5} />
              {busy === 'extract' ? c.extracting : c.extract}
            </button>
            {!canAi && <span className="text-[12.5px] text-ink-mute">{c.readNoKey}</span>}
            {canAi && images.length > 0 && images.length < 8 && (
              <span className="text-[12.5px] text-ink-mute">{c.readFew.replace('{n}', String(images.length))}</span>
            )}
          </div>
          {note && (
            <p role="alert" className={`mt-3 rounded-xl2 px-4 py-2.5 text-[14px] ${note.tone === 'bad' ? 'border border-bad/25 bg-bad-wash text-bad' : 'border border-good/25 bg-good-wash text-good'}`}>
              {note.text}
            </p>
          )}
        </div>
      )}

      {(producer || hasBrand) && (
        <form action={action} className="mt-8">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="brand" value={JSON.stringify(draft)} />

          {/* ── the sheet ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-[20px] font-semibold text-ink">{c.sheet.title}</h3>
              <p className="text-[13.5px] text-ink-mute">{producer ? c.sheet.sub : ''}{draft.by && <span className="ms-1">· {draft.by === 'ai' ? c.sheet.byAi : c.sheet.byHand}</span>}</p>
            </div>
            {producer && <div className="flex items-center gap-3">{savedAt > 0 && <span className="text-[13px] text-good">{c.sheet.saved}</span>}<SaveButton /></div>}
          </div>
          {state && !state.ok && state.error && <p role="alert" className="mt-3 text-[14px] text-bad">{state.error}</p>}

          <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-[12.5px] font-semibold tracking-[.08em] text-ink-mute">{c.sheet.palette}</p>
              <ul className="mt-2 grid grid-cols-5 gap-2">
                {PALETTE_ROLES.map((role) => {
                  const s = draft.palette.find((x) => x.role === role)!;
                  return (
                    <li key={role} className="min-w-0">
                      <label className="block cursor-pointer">
                        <span className="block h-16 rounded-xl2 border border-line" style={{ background: s.hex }} />
                        {producer && <input type="color" value={s.hex} onChange={(e) => setSwatch(role, { hex: e.target.value })} className="sr-only" aria-label={`${c.sheet.roles[role]} ${s.hex}`} />}
                      </label>
                      <p className="mt-1.5 text-[12px] font-medium text-ink">{c.sheet.roles[role]}</p>
                      <p className="text-[11.5px] tabular-nums text-ink-mute" dir="ltr">{s.hex}</p>
                      {producer ? (
                        <input className="field mt-1 px-2 py-1 text-[12px]" value={s.name} onChange={(e) => setSwatch(role, { name: e.target.value })} aria-label={c.sheet.swatchName} />
                      ) : (
                        s.name && <p className="text-[12px] text-ink-soft">{s.name}</p>
                      )}
                    </li>
                  );
                })}
              </ul>

              <p className="mt-5 text-[12.5px] font-semibold tracking-[.08em] text-ink-mute">{c.sheet.fonts}</p>
              {producer ? (
                <select className="field mt-2" value={draft.fonts} onChange={(e) => set('fonts', e.target.value as WeddingBrand['fonts'])} aria-label={c.sheet.fonts}>
                  {FONT_PAIRS.map((p) => <option key={p.key} value={p.key}>{p.display} + {p.body}</option>)}
                </select>
              ) : null}
              <div className="mt-2 rounded-xl2 border border-line bg-surface-100 px-4 py-3">
                <p style={{ fontFamily: `'${pair.display}', ${pair.serif ? 'serif' : 'sans-serif'}` }} className="text-[26px] leading-tight text-ink">{data.displayName}</p>
                <p style={{ fontFamily: `'${pair.body}', sans-serif` }} className="mt-1 text-[14px] text-ink-soft">{pair.display} · {pair.body}</p>
              </div>
              <p className="mt-1.5 text-[12px] text-ink-mute">{c.sheet.fontsHint}</p>
            </div>

            <div className="space-y-4">
              <Field label={c.sheet.words} producer={producer} value={draft.words.join(', ')} onChange={(v) => set('words', v.split(/[,،]/).map((s) => s.trim()).filter(Boolean).slice(0, 3))} chips={draft.words} />
              <Field label={c.sheet.motifs} producer={producer} value={draft.motifs.join(', ')} onChange={(v) => set('motifs', v.split(/[,،]/).map((s) => s.trim()).filter(Boolean).slice(0, 4))} chips={draft.motifs} />
              <Field label={c.sheet.voice} producer={producer} value={draft.voice} onChange={(v) => set('voice', v)} rows={2} placeholder={c.sheet.voicePh} />
              <Field label={c.sheet.direction} producer={producer} value={draft.direction} onChange={(v) => set('direction', v)} rows={4} />
              <div>
                <p className="text-[12.5px] font-semibold tracking-[.08em] text-ink-mute">{c.sheet.lean}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {(['safe', 'bold'] as Variant[]).map((v) => (
                    <button key={v} type="button" disabled={!producer} onClick={() => set('lean', v)} aria-pressed={draft.lean === v}
                      className={`rounded-xl2 px-3 py-1.5 text-[13px] ${draft.lean === v ? 'bg-ink text-surface' : 'border border-line bg-surface-100 text-ink-soft'}`}>
                      {v === 'safe' ? c.sheet.leanSafe : c.sheet.leanBold}
                    </button>
                  ))}
                  {draft.leanReason && <span className="text-[13px] text-ink-soft">{draft.leanReason}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── the texts ─────────────────────────────────────────────── */}
          {producer && (
            <div className="mt-8">
              <h3 className="font-display text-[18px] font-semibold text-ink">{c.texts.title}</h3>
              <p className="text-[13.5px] text-ink-mute">{c.texts.sub}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-[13px] text-ink-soft">{c.texts.story}
                  <textarea className="field" rows={3} value={draft.texts.story} onChange={(e) => setText('story', e.target.value)} placeholder={c.texts.storyPh} /></label>
                <label className="grid gap-1 text-[13px] text-ink-soft">{c.texts.travel}
                  <textarea className="field" rows={3} value={draft.texts.travel} onChange={(e) => setText('travel', e.target.value)} placeholder={c.texts.travelPh} /></label>
                <label className="grid gap-1 text-[13px] text-ink-soft">{c.texts.registry}
                  <textarea className="field" rows={2} value={draft.texts.registry} onChange={(e) => setText('registry', e.target.value)} placeholder={c.texts.registryPh} /></label>
                <label className="grid gap-1 text-[13px] text-ink-soft">{c.texts.menu}
                  <textarea className="field" rows={3} value={draft.texts.menu} onChange={(e) => setText('menu', e.target.value)} placeholder={c.texts.menuPh} /></label>
              </div>
            </div>
          )}
        </form>
      )}

      {/* ── the pieces ──────────────────────────────────────────────── */}
      {(producer || hasBrand) && (
        <div className="mt-10">
          <h3 className="font-display text-[20px] font-semibold text-ink">{c.pieces.title}</h3>
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-mute">{c.pieces.sub}</p>
          <p className="mt-1 text-[12.5px] text-ink-mute">{c.pieces.sizes}</p>
          {data.tables.length === 0 && <p className="mt-1 text-[12.5px] text-ink-mute">{c.pieces.tablesNone}</p>}

          <div className="mt-6 space-y-10">
            {PIECES.map((p) => {
              const picked = variantFor(draft, p.key);
              return (
                <div key={p.key} className="border-t border-line pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[16px] font-semibold text-ink">{c.pieces.names[p.key]}</h4>
                    {p.key === 'website' ? (
                      siteUrl ? <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5 text-[13px]"><ExternalLink size={14} aria-hidden strokeWidth={1.5} />{c.pieces.openSite}</a> : null
                    ) : producer ? (
                      <a href={`${printBase}/${p.key}`} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5 text-[13px]" title={c.pieces.printHint}>
                        <Printer size={14} aria-hidden strokeWidth={1.5} />{c.pieces.print}
                      </a>
                    ) : null}
                  </div>
                  {p.key === 'website' && <p className="mt-1 text-[12.5px] text-ink-mute">{c.pieces.siteNote}</p>}
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    {(['safe', 'bold'] as Variant[]).map((v) => (
                      <div key={v}>
                        <div className="flex flex-wrap items-start gap-3">
                          <Mock kind={p.key}>
                            <Piece kind={p.key} variant={v} brand={draft} data={data} c={c.on} locale={ui.locale} />
                          </Mock>
                          {p.pages === 'two' && (
                            <Mock kind={p.key} fit={120}>
                              <Piece kind={p.key} variant={v} brand={draft} data={data} c={c.on} locale={ui.locale} page={1} />
                            </Mock>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{v === 'safe' ? c.pieces.safe : c.pieces.bold}</span>
                          {draft.lean === v && draft.leanReason && <span className="text-[12px] text-accent">· {c.pieces.fits}</span>}
                          <form action={pickBrandVariant} onSubmit={() => setDraft((d) => ({ ...d, picks: { ...d.picks, [p.key]: v } }))}>
                            <input type="hidden" name="client_id" value={clientId} />
                            <input type="hidden" name="piece" value={p.key} />
                            <input type="hidden" name="variant" value={v} />
                            <button type="submit" aria-pressed={picked === v}
                              className={`rounded-xl2 px-3 py-1 text-[12.5px] ${picked === v ? 'bg-ink text-surface' : 'border border-line bg-surface-100 text-ink-soft hover:bg-surface-200'}`}>
                              {picked === v ? c.pieces.picked : c.pieces.pick}
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── where to print ─────────────────────────────────────────── */}
          <div className="mt-10 border-t border-line pt-6">
            <h3 className="font-display text-[18px] font-semibold text-ink">{c.printers.title}</h3>
            <p className="max-w-2xl text-[13.5px] text-ink-mute">{c.printers.sub}</p>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              {c.printers.list.map((p, i) => (
                <li key={p.name} className="rounded-xl2 border border-line bg-surface-100 p-4">
                  <p className="text-[14.5px] font-semibold text-ink"><span className="tabular-nums text-ink-mute">{i + 1}.</span> {p.name}</p>
                  <p className="text-[12.5px] text-accent">{p.level}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{p.note}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-ink-soft">{c.printers.local}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, producer, value, onChange, rows, placeholder, chips }: {
  label: string; producer: boolean; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; chips?: string[];
}) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold tracking-[.08em] text-ink-mute">{label}</p>
      {producer ? (
        rows ? (
          <textarea className="field mt-1.5" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
        ) : (
          <input className="field mt-1.5" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
        )
      ) : chips ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map((w) => <span key={w} className="rounded-xl2 border border-line bg-surface-100 px-2.5 py-1 text-[13px] text-ink">{w}</span>)}
        </div>
      ) : (
        <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{value}</p>
      )}
    </div>
  );
}

export type { PieceKey };
