'use client';

import { useRef, useState, useTransition } from 'react';
import { Download, FileText, Image as ImageIcon, Film, Music, Table2, Upload, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { registerFile, deleteFile, noteFile } from '@/app/actions/files';
import { fileAllowed, guessMime, humanSize, MAX_FILE_BYTES } from '@/lib/fileTypes';
import { appCopy } from '@/content/site';
import { Ltr } from '@/components/Ltr';

export type EventFile = {
  id: string;
  name: string;
  note: string;
  mime: string;
  size_bytes: number;
  created_at: string;
  uploader: string;
  /** Whether this viewer put it here. Answered by the loader from the same
   *  column the delete policy reads, so the button and the policy agree. */
  mine: boolean;
  url: string;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

const c = appCopy.files;
const isImage = (m: string) => m.startsWith('image/');

function Icon({ mime }: { mime: string }) {
  const props = { size: 17, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (isImage(mime)) return <ImageIcon {...props} />;
  if (mime.startsWith('video/')) return <Film {...props} />;
  if (mime.startsWith('audio/')) return <Music {...props} />;
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return <Table2 {...props} />;
  return <FileText {...props} />;
}

/** The signed link opens the file; the same link with a name on it saves it
 *  under that name rather than under the random one it is stored as. */
const downloadHref = (f: EventFile) =>
  `${f.url}${f.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(f.name)}`;

/**
 * The shared folder for one event.
 *
 * Both sides put things in it and both sides see everything in it — a file one
 * side cannot see is not a shared folder, it is two folders and a
 * misunderstanding. Anything genuinely producer-only already has a home: cost
 * in the budget, crew in the crew panel, the signed agreement in contracts.
 *
 * Files go straight from the browser to storage rather than through a server
 * action. A server action is a request body, and a request body has a limit
 * measured in single megabytes: a photograph off a phone is already past it.
 * The browser uploads under its own session, so the same row level policies
 * decide whether it may, and the server only records what landed.
 */
export function EventFiles({ clientId, files, viewer }: {
  clientId: string; files: EventFile[]; viewer: 'producer' | 'client';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [, start] = useTransition();

  const send = async (chosen: FileList | File[]) => {
    const list = Array.from(chosen);
    if (list.length === 0) return;
    setError('');
    setBusy(list.map((f) => f.name));

    const sb = supabaseBrowser();
    let failed = '';

    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) { failed = c.tooBig; continue; }
      /* A browser that does not recognise the type sends an empty string, and
         refusing on that would block a plain .csv off a Mac. The extension is
         what carries it in that case, and the server checks the type it is
         told either way. */
      const mime = file.type || guessMime(file.name);
      if (!fileAllowed(mime)) { failed = c.badType; continue; }

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      /* The first segment is the workspace, because that is what the storage
         policy reads to decide who may touch the object. */
      const path = `${clientId}/${crypto.randomUUID()}.${ext || 'bin'}`;

      const { error: upErr } = await sb.storage.from('files').upload(path, file, {
        contentType: mime, upsert: false,
      });
      if (upErr) { failed = c.failed; continue; }

      const res = await registerFile({
        clientId, path, name: file.name, mime, size: file.size,
      });
      if (!res.ok) failed = res.error ?? c.failed;
    }

    setBusy([]);
    setError(failed);
    if (input.current) input.current.value = '';
  };

  const photos = files.filter((f) => isImage(f.mime));
  const docs = files.filter((f) => !isImage(f.mime));

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[22px] font-light text-ink">{c.title}</h2>
        <p className="text-[13.5px] text-ink-mute">{viewer === 'client' ? c.subClient : c.subProducer}</p>
      </div>

      {/* Both sides may add. The couple is who this was built for, but a
          producer handing back a floor plan should not have to email it. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setOver(false);
          if (e.dataTransfer.files?.length) void send(e.dataTransfer.files);
        }}
        className={`mt-5 rounded-card-sm border border-dashed p-5 text-center transition ${
          over ? 'border-accent bg-accent-wash' : 'border-line-strong bg-surface-100'
        }`}
      >
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-button border border-line-strong bg-card px-5 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent">
          <Upload size={16} aria-hidden strokeWidth={1.5} />
          {busy.length > 0 ? c.adding : c.add}
          <input
            ref={input} type="file" multiple className="sr-only" aria-label={c.add}
            onChange={(e) => { if (e.target.files?.length) void send(e.target.files); }}
          />
        </label>
        <p className="mt-3 text-[13.5px] text-ink-soft">{c.drop}</p>
        <p className="mt-1 text-[12.5px] text-ink-mute">{c.dropHint}</p>

        {busy.length > 0 && (
          <ul className="mt-3 space-y-1" aria-live="polite">
            {busy.map((n) => (
              <li key={n} className="truncate text-[13px] text-ink-mute">{c.adding} · {n}</li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {error}
        </p>
      )}

      {files.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{viewer === 'client' ? c.none : c.noneProducer}</p>
      ) : (
        <div className="mt-6 space-y-6">
          {photos.length > 0 && (
            <div>
              <p className="text-[11.5px] tracking-[.14em] text-ink-mute">{c.photos}</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((f) => (
                  <li key={f.id} className="overflow-hidden rounded-card-sm border border-line bg-surface-100">
                    <a href={f.url} target="_blank" rel="noreferrer" className="block">
                      {/* a plain img: these are signed one-off URLs, not a fixed asset path */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.note || f.name} className="h-36 w-full object-cover" loading="lazy" />
                    </a>
                    <Row file={f} clientId={clientId} viewer={viewer} start={start} compact />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {docs.length > 0 && (
            <div>
              <p className="text-[11.5px] tracking-[.14em] text-ink-mute">{c.documents}</p>
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {docs.map((f) => (
                  <li key={f.id} className="py-3">
                    <Row file={f} clientId={clientId} viewer={viewer} start={start} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ file: f, clientId, viewer, start, compact }: {
  file: EventFile; clientId: string; viewer: 'producer' | 'client';
  start: (fn: () => void) => void; compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  /* A producer may clear anything from their own event; anybody may take back
     what they themselves put there. The same two conditions the delete policy
     checks, so no button is offered that the database would refuse. */
  const canRemove = f.mine || viewer === 'producer';

  return (
    <div className={compact ? 'p-3' : 'flex flex-wrap items-start justify-between gap-3'}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-ink-mute"><Icon mime={f.mime} /></span>
          <a
            href={f.url} target="_blank" rel="noreferrer"
            className="truncate text-[14.5px] text-ink transition hover:text-accent"
            title={f.name}
          >
            <Ltr>{f.name}</Ltr>
          </a>
        </div>

        {f.note && <p className="mt-1 text-[13.5px] text-ink-soft">{f.note}</p>}

        <p className="mt-1 text-[12.5px] text-ink-mute">
          {c.by} {f.uploader} · {dateFmt.format(new Date(f.created_at))}
          {f.size_bytes > 0 && <> · <Ltr>{humanSize(f.size_bytes)}</Ltr></>}
        </p>

        {editing && (
          <form
            action={(fd) => { start(() => void noteFile(fd)); setEditing(false); }}
            className="mt-2 flex flex-wrap gap-2"
          >
            <input type="hidden" name="file_id" value={f.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <input
              name="note" defaultValue={f.note} maxLength={300} placeholder={c.notePh}
              className="field flex-1" aria-label={c.note} autoComplete="off"
            />
            <button type="submit" className="btn-quiet whitespace-nowrap px-3 text-[13.5px]">{c.noteSave}</button>
          </form>
        )}
      </div>

      <div className={`flex shrink-0 items-center gap-1 ${compact ? 'mt-2' : ''}`}>
        <a
          href={downloadHref(f)}
          className="btn-quiet inline-flex items-center gap-1.5 px-2 py-1 text-[13px]"
          aria-label={`${c.download} ${f.name}`}
        >
          <Download size={15} aria-hidden strokeWidth={1.5} />
          <span className={compact ? 'sr-only' : ''}>{c.download}</span>
        </a>

        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="btn-quiet px-2 py-1 text-[13px]">
            {c.note}
          </button>
        )}

        {canRemove && (
          <form action={(fd) => start(() => void deleteFile(fd))}>
            <input type="hidden" name="file_id" value={f.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button
              type="submit"
              className="btn-quiet inline-flex items-center gap-1.5 px-2 py-1 text-[13px]"
              aria-label={`${c.remove} ${f.name}`}
            >
              <X size={15} aria-hidden strokeWidth={1.5} />
              <span className={compact ? 'sr-only' : ''}>{c.remove}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
