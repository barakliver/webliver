'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { appCopy } from '@/content/site';
import type { Receipt } from '@/lib/ai/receipt';

const c = appCopy.money;

/* Long enough that the whole receipt is legible, small enough that a phone on
   a venue's wifi sends it in a second. A 12 megapixel photograph of a piece of
   paper carries no more readable text than this does; it just takes twenty
   times longer to upload. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Scale the photograph down in the browser, before it is sent.
 *
 * Not an optimisation. A modern phone camera produces four to eight megabytes
 * per shot, and sending that from a venue is the difference between this
 * feeling instant and feeling broken. Falls back to the original file if the
 * canvas path fails for any reason, because a slow read beats no read.
 */
async function shrink(file: File): Promise<{ media_type: string; data: string }> {
  const asBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const url = String(reader.result);
        resolve(url.slice(url.indexOf(',') + 1));
      };
      reader.readAsDataURL(blob);
    });

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return { media_type: file.type, data: await asBase64(file) };
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no context');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('no blob');
    return { media_type: 'image/jpeg', data: await asBase64(blob) };
  } catch {
    return { media_type: file.type, data: await asBase64(file) };
  }
}

/**
 * Photograph a supplier's receipt, and have the budget line fill itself in.
 *
 * It fills the form and stops there. The producer reads what it wrote and
 * presses the button that already existed. That is the whole safety design:
 * a number this got wrong is visible next to the paper it came from, and it is
 * corrected by typing over it, before anything is saved.
 *
 * The photograph is not stored anywhere. It goes up, it is read, it is gone.
 */
export function ReceiptScan({ clientId, formId }: { clientId: string; formId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const fill = (r: Receipt) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const set = (name: string, value: string) => {
      const field = form.elements.namedItem(name);
      /* Only overwrite a field somebody has not already typed into. Reading a
         second receipt should not erase the vendor they corrected by hand. */
      if (field instanceof HTMLInputElement && value && !field.value) field.value = value;
    };
    set('vendor', r.vendor);
    set('label', r.label);
    set('estimate', r.amount > 0 ? String(r.amount) : '');
    /* The agreed figure, not only the estimate: a receipt is not a quote, it
       is what was actually paid. */
    set('agreed', r.amount > 0 ? String(r.amount) : '');

    const focus = form.elements.namedItem(r.amount > 0 ? 'label' : 'estimate');
    if (focus instanceof HTMLInputElement) focus.focus();
  };

  const read = async (file: File) => {
    setBusy(true);
    setNote(null);
    try {
      const image = await shrink(file);
      const res = await fetch('/api/receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ...image }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; receipt?: Receipt };

      if (!data.ok || !data.receipt) {
        setNote({ text: data.error || c.scanFailed, bad: true });
        return;
      }
      fill(data.receipt);
      setNote(
        data.receipt.sure
          ? { text: c.scanFilled, bad: false }
          : { text: c.scanUnsure, bad: true },
      );
    } catch {
      setNote({ text: c.scanFailed, bad: true });
    } finally {
      setBusy(false);
      /* Cleared so that photographing the same receipt twice still fires a
         change event. */
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mt-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        /* Opens the camera on a phone and the file picker on a laptop, which
           is the right thing on both without asking which one this is. */
        capture="environment"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="btn-ghost inline-flex items-center gap-2 disabled:opacity-60"
        >
          {busy
            ? <Loader2 size={16} strokeWidth={1.5} aria-hidden className="animate-spin" />
            : <Camera size={16} strokeWidth={1.5} aria-hidden />}
          {busy ? c.scanning : c.scan}
        </button>
        <p className="text-[12.5px] text-ink-mute">{c.scanHint}</p>
      </div>

      {note && (
        <p
          role="status"
          className={`mt-2.5 text-[13px] ${note.bad ? 'text-warn' : 'text-ok'}`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
