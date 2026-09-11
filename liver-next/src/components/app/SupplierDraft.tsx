'use client';

import { useState } from 'react';
import { MessageCircle, Copy, Sparkles, X } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { draftSupplierMessage, type DraftResult } from '@/app/actions/assist';

/**
 * A message to the supplier, drafted, edited, and then sent by a person.
 *
 * Round five of the planning brief: help that reads the screen it is on.
 * Beside a quote with blanks, the useful help is a message that asks the
 * supplier to fill them in, with the wedding's own facts already in it.
 *
 * Two boxes, and they are never one box. The left one is what is known,
 * drawn as facts from rows the couple can see. The right one is the draft,
 * drawn as a suggestion with its author named beside it — the model when
 * there was a key and it answered, the template otherwise — and it is a
 * textarea, because a message a person cannot change is a message a person
 * will not send.
 *
 * Nothing leaves this component on its own. The button opens WhatsApp with
 * the text as it stands after editing, or copies it when the supplier has
 * no phone on the row; a person presses send. Nothing is written to the
 * event either: a draft is not a record.
 */
export function SupplierDraft({ eventVendorId, supplierName, demo }: {
  eventVendorId: string;
  supplierName: string;
  /** The gallery's way in: opened with this result on arrival. */
  demo?: DraftResult;
}) {
  const c = useCopy().vendor.quotes.assist;
  const [open, setOpen] = useState(!!demo);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DraftResult | null>(demo ?? null);
  const [text, setText] = useState(demo?.draft ?? '');
  const [copied, setCopied] = useState(false);

  const ask = async () => {
    setBusy(true);
    const r = await draftSupplierMessage({ eventVendorId });
    setBusy(false);
    setRes(r);
    setText(r.draft ?? '');
    setOpen(true);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { window.prompt(c.copy, text); }
  };

  /* Closed, it is one button in a row of its siblings, and the supplier's
     name is on it: three buttons that all say "the supplier" read as three
     copies of one. Open, it takes the whole row. */
  if (!open) {
    return (
      <button
        type="button" onClick={() => void ask()} disabled={busy}
        className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-[12.5px]"
      >
        <Sparkles size={12} aria-hidden strokeWidth={1.5} />
        {busy ? c.drafting : fill(c.draftTo, { name: supplierName })}
      </button>
    );
  }

  return (
    <div className="mt-1 min-w-0 basis-full rounded-xl2 border border-line bg-surface-100 p-4" role="region" aria-label={`${c.draft}: ${supplierName}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[14px] font-medium text-ink">{supplierName}</p>
        <button type="button" onClick={() => setOpen(false)} className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-[12.5px]" aria-label={c.close}>
          <X size={13} aria-hidden strokeWidth={1.5} />{c.close}
        </button>
      </div>

      {res && !res.ok && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{res.error}</p>
      )}

      {res?.ok && (
        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* The facts. Only what the rows say; nothing the model added. */}
          <div>
            <p className="eyebrow">{c.facts}</p>
            <ul className="mt-2 list-none space-y-1 p-0 text-[13.5px] text-ink-soft">
              {(res.facts ?? []).map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
          {/* The suggestion, with its author named, and editable. */}
          <div>
            <p className="eyebrow">
              {c.suggestion}
              <span className="ms-2 font-normal normal-case tracking-normal text-ink-mute">
                {res.by === 'model' ? c.byModel : c.byTemplate}
              </span>
            </p>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)}
              rows={9} aria-label={c.suggestion}
              className="field mt-2 min-h-[12rem] resize-y text-[14.5px] leading-relaxed"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {res.phone ? (
                <a
                  href={`https://wa.me/${res.phone.replace('+', '')}?text=${encodeURIComponent(text)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 text-[14px]"
                >
                  <MessageCircle size={15} aria-hidden strokeWidth={1.5} />
                  {c.openWhatsApp}
                </a>
              ) : (
                <span className="text-[12.5px] text-ink-mute">{c.noPhone}</span>
              )}
              <button type="button" onClick={() => void copy()} className="btn-ghost inline-flex items-center gap-2 text-[14px]">
                <Copy size={14} aria-hidden strokeWidth={1.5} />
                {copied ? c.copied : c.copy}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-ink-mute">{c.notSent}</p>
          </div>
        </div>
      )}
    </div>
  );
}
