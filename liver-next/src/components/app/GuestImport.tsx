'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { importGuests } from '@/app/actions/guests';
import type { ImportReport } from '@/lib/guestImport';
import { appCopy } from '@/content/site';

const c = appCopy.guestImport;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
      <Upload size={16} aria-hidden strokeWidth={1.5} />
      {pending ? c.importing : c.import}
    </button>
  );
}

/** Bringing in the list the couple already keeps somewhere else, and taking it
 *  back out for the caterer. Both directions matter: a guest list that can only
 *  be typed in is a guest list nobody moves to. */
export function GuestImport({ clientId }: { clientId: string }) {
  const [report, action] = useActionState<ImportReport | null, FormData>(importGuests, null);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost inline-flex items-center gap-2 text-[14px]">
          <FileSpreadsheet size={16} aria-hidden strokeWidth={1.5} />
          {c.open}
        </button>
        <a href={`/app/clients/${clientId}/guests.csv`} className="btn-ghost inline-flex items-center gap-2 text-[14px]">
          <Download size={16} aria-hidden strokeWidth={1.5} />
          {c.export}
        </a>
      </div>

      {open && (
        <form action={action} className="mt-4 rounded-none bg-surface-100 p-4">
          <input type="hidden" name="client_id" value={clientId} />
          <p className="text-[14px] text-ink-soft">{c.hint}</p>

          <input
            type="file"
            name="file"
            accept=".csv,text/csv,text/plain"
            className="mt-3 block w-full text-[14px] file:mr-3 file:min-h-[44px] file:rounded-none sm:min-h-[38px] file:border-0 file:bg-ink file:px-4 file:text-[14px] file:text-surface"
          />

          <p className="mt-3 text-[13px] text-ink-mute">{c.orPaste}</p>
          <textarea
            name="text"
            rows={4}
            placeholder={c.pastePh}
            className="field mt-1.5 w-full font-mono text-[13px]"
          />

          <div className="mt-3"><Submit /></div>

          {report && (
            <div role="status" className="mt-4 space-y-2 text-[14px]">
              {report.ok ? (
                <p className="rounded-none bg-ok-wash px-4 py-2.5 text-ok">
                  {report.added === 0 ? c.nothingNew : `${c.added} ${report.added}`}
                  {report.duplicates ? ` · ${report.duplicates} ${c.duplicates}` : ''}
                </p>
              ) : (
                <p className="rounded-none bg-bad-wash px-4 py-2.5 text-bad">{report.error}</p>
              )}

              {/* Line numbers, not a count. "398 of 400" is a mystery; "line 3
                  had no name" is something to go and fix. */}
              {report.skipped && report.skipped.length > 0 && (
                <details className="rounded-none bg-warn-wash px-4 py-2.5 text-warn">
                  <summary className="cursor-pointer">{report.skipped.length} {c.skipped}</summary>
                  <ul className="mt-2 space-y-0.5 text-[13px]">
                    {report.skipped.slice(0, 30).map((s) => (
                      <li key={s.line}>{c.line} {s.line}: {s.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
