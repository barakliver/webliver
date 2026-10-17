'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { FileUp, Sparkles } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { cn } from '@/lib/utils';

/**
 * A file or a paragraph, dropped on an event and read.
 *
 * The simplest door into the box and the one that proves the whole
 * pipeline: no provider, no webhook, a PDF from the desktop or a message
 * pasted from a phone. It posts to the upload route rather than to a
 * server action because a scanned quote is bigger than an action body
 * may be. What comes back is the reading's sentence and how many
 * proposals now wait, with the way to them.
 */
export function InboxDrop({ clientId }: { clientId: string }) {
  const c = useCopy().inbox.drop;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ ok: boolean; text: string; pending?: number } | null>(null);

  const send = async () => {
    if (!files.length && !note.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set('client_id', clientId);
      form.set('note', note);
      for (const f of files) form.append('file', f);
      const res = await fetch('/api/inbox/upload', { method: 'POST', body: form });
      const data = (await res.json()) as { ok: boolean; error?: string; summary?: string; pending?: number };
      if (!res.ok || !data.ok) { setResult({ ok: false, text: data.error ?? c.failed }); return; }
      setResult({ ok: true, text: `${data.summary ? data.summary + ' ' : ''}${data.pending ? fill(c.done, { n: data.pending }) : c.doneNone}`, pending: data.pending });
      setFiles([]);
      setNote('');
    } catch {
      setResult({ ok: false, text: c.failed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3" aria-labelledby="inbox-drop">
      <div>
        <h2 id="inbox-drop" className="head-section flex items-center gap-2"><Sparkles size={17} strokeWidth={1.5} aria-hidden className="text-accent" />{c.title}</h2>
        <p className="text-body text-ink-soft">{c.sub}</p>
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setFiles([...files, ...Array.from(e.dataTransfer.files)].slice(0, 5)); }}
        className={cn('flex w-full items-center justify-center gap-2 rounded-card-sm border border-dashed px-4 py-6 text-body transition-colors duration-touch',
          over ? 'border-accent bg-accent-wash text-accent' : 'border-line text-ink-soft hover:border-accent')}
      >
        <FileUp size={18} strokeWidth={1.5} aria-hidden />
        {files.length ? files.map((f) => f.name).join(', ') : c.drop}
      </button>
      <input ref={input} type="file" multiple accept="application/pdf,image/*,text/plain" className="sr-only" aria-label={c.drop}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={c.paste} aria-label={c.paste} className="input" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={send} disabled={busy || (!files.length && !note.trim())} className="btn-primary disabled:opacity-60">
          {busy ? c.busy : c.read}
        </button>
        {result && (
          <span className={cn('text-body', result.ok ? 'text-ink' : 'text-bad')} role={result.ok ? undefined : 'alert'}>
            {result.text}{' '}
            {result.ok && result.pending ? <Link href="/app/inbox" className="underline">{c.toInbox}</Link> : null}
          </span>
        )}
      </div>
    </section>
  );
}
