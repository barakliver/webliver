'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Upload, Download, FileSpreadsheet, Eye } from 'lucide-react';
import { importGuests, previewGuests } from '@/app/actions/guests';
import type { ImportReport } from '@/lib/guestImport';
import { Ltr, Name } from '@/components/Ltr';
import { count } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';

function Pressed({ label, busy, icon: Icon, onPress }: {
  label: string; busy: string; icon: typeof Upload; onPress?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending} onClick={onPress}
      className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
    >
      <Icon size={16} aria-hidden strokeWidth={1.5} />
      {pending ? busy : label}
    </button>
  );
}

/**
 * Bringing in the list the couple already keeps somewhere else, and taking it
 * back out for the caterer. Both directions matter: a guest list that can only
 * be typed in is a guest list nobody moves to.
 *
 * It is two presses rather than one, and that is the whole of what changed.
 * Pasting two hundred lines and pressing once was the only write on this
 * screen with no way back - deleting two hundred guests one at a time is not
 * a recovery - and it was also the write most likely to be quietly wrong,
 * because the whole job is guessing where a line comes apart. A couple who
 * pasted their mother's list from a chat had no way to learn that every phone
 * number had ended up inside a name until they scrolled their own guest list
 * weeks later.
 *
 * So the first press reads and shows, and the second writes. The reading is
 * the plan and not an impression of it: both presses run the same two
 * functions over the same text, which travels in the form rather than being
 * remembered on the server.
 *
 * The preview leads with the party sizes, because that is the one column the
 * reader is genuinely guessing at: a plus means one more than the person
 * named and every other notation means how many altogether, and the
 * difference is one person per line.
 */
export function GuestImport({ clientId }: { clientId: string }) {
  const c = useCopy().guestImport;
  const [open, setOpen] = useState(false);
  /* Held here so the second press sends the same text the first one read,
     and so a couple who goes back still has their list in the box. */
  const [text, setText] = useState('');

  const [report, read] = useActionState<ImportReport | null, FormData>(previewGuests, null);
  const [written, write] = useActionState<ImportReport | null, FormData>(importGuests, null);

  /* Which of the two answers is on the screen, held explicitly rather than
     worked out from whichever is not null. `useActionState` has no way to be
     put back to null, so the write's answer is still sitting there the next
     time somebody pastes a list: "the later of the two" would have meant the
     second import never showed its preview at all. It is also what the way
     back from the preview moves. */
  const [stage, setStage] = useState<'form' | 'preview' | 'done'>('form');

  useEffect(() => {
    if (!report) return;
    const ready = report.ok && report.preview === true && (report.ready ?? 0) > 0;
    setStage(ready ? 'preview' : 'form');
  }, [report]);

  useEffect(() => {
    if (!written) return;
    setStage('done');
    /* Their list is in the rows now. Leaving it in the box is an invitation
       to press again, and the second press is the one that doubles a guest
       list. */
    if (written.ok && (written.added ?? 0) > 0) setText('');
  }, [written]);

  const shown = stage === 'done' ? written : report;
  const previewing = stage === 'preview';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn-ghost inline-flex items-center gap-2 text-body">
          <FileSpreadsheet size={16} aria-hidden strokeWidth={1.5} />
          {c.open}
        </button>
        <a href={`/app/clients/${clientId}/guests.csv`} className="btn-ghost inline-flex items-center gap-2 text-body">
          <Download size={16} aria-hidden strokeWidth={1.5} />
          {c.export}
        </a>
      </div>

      {open && (
        <div className="mt-4 rounded-card-sm border border-line-soft bg-surface-100 p-4">
          {/* The two forms are siblings rather than one form with two
              buttons, and never nested: a form inside a form is dropped by
              the parser, React's tree and the DOM stop matching, and the
              whole page is thrown away and rebuilt. */}
          <form action={read} className={previewing ? 'hidden' : undefined}>
            <input type="hidden" name="client_id" value={clientId} />

            <p className="text-body leading-relaxed text-ink-soft">{c.orPaste}</p>
            <textarea
              name="text" rows={5} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={c.pastePh}
              className="field mt-1.5 w-full text-body"
              dir="auto" autoComplete="off"
            />

            <p className="mt-4 text-meta leading-relaxed text-ink-mute">{c.hint}</p>
            {/* A chosen file is read into the box rather than posted as a
                file, and that is not a detail. The confirm is a second form
                and a file input's value cannot be filled in by script, so a
                file would have been read for the preview and then gone
                missing at the press that writes. Loading it into the box
                gives both presses one thing to read, lets somebody fix a
                line before importing it, and makes the preview a preview of
                what will actually be written. The `name` is dropped for the
                same reason: nothing should post this twice. */}
            <input
              type="file" accept=".csv,text/csv,text/plain" aria-label={c.fileLabel}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
                setStage('form');
              }}
              className="mt-2 block w-full text-body file:me-3 file:min-h-[44px] file:rounded-control file:border-0 file:bg-ink file:px-4 file:text-body file:text-surface sm:file:min-h-[38px]"
            />

            <div className="mt-4">
              <Pressed label={c.read} busy={c.reading} icon={Eye} onPress={() => setStage('form')} />
            </div>
          </form>

          {previewing && shown?.ok && (
            <form action={write}>
              <input type="hidden" name="client_id" value={clientId} />
              {/* The same text the preview read, so the two presses cannot be
                  looking at different lists. */}
              <input type="hidden" name="text" value={text} />

              <h3 className="head-sub">{c.previewTitle}</h3>
              <p className="mt-1 max-w-prose2 text-body leading-relaxed text-ink-soft">{c.previewSub}</p>

              <Counts report={shown} />

              {/* How many comes second, directly after the name, because it
                  is the column the reader is guessing at and the one worth
                  checking. It was fourth and 420px wide, which on a phone
                  put the one figure this table exists for off the right of
                  the screen. The three narrow columns take only the width
                  they need and the name wraps into what is left. */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-line text-meta text-ink-mute">
                      <th scope="col" className="py-1.5 text-start font-medium">{c.colName}</th>
                      <th scope="col" className="w-px whitespace-nowrap py-1.5 pe-3 text-start font-medium">{c.colParty}</th>
                      <th scope="col" className="w-px whitespace-nowrap py-1.5 pe-3 text-start font-medium">{c.colPhone}</th>
                      <th scope="col" className="w-px whitespace-nowrap py-1.5 text-start font-medium">{c.colSide}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {(shown.sample ?? []).map((r, i) => (
                      <tr key={`${r.name}-${i}`}>
                        <td className="py-1.5 pe-3 text-ink"><Name>{r.name}</Name></td>
                        <td className="w-px whitespace-nowrap py-1.5 pe-3 tabular-nums text-ink">{r.party}</td>
                        <td className="w-px whitespace-nowrap py-1.5 pe-3 text-ink-soft">{r.phone ? <Ltr>{r.phone}</Ltr> : <Blank />}</td>
                        <td className="w-px whitespace-nowrap py-1.5 text-ink-soft">{r.side || <Blank />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(shown.ready ?? 0) > (shown.sample?.length ?? 0) && (
                <p className="mt-2 text-meta text-ink-mute">
                  {count(c.andMore, (shown.ready ?? 0) - (shown.sample?.length ?? 0))}
                </p>
              )}

              <Repeated names={shown.repeated ?? []} />
              <Skipped report={shown} />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Pressed label={count(c.confirm, shown.ready ?? 0)} busy={c.importing} icon={Upload} />
                <button type="button" onClick={() => setStage('form')} className="btn-quiet px-2 py-1 text-body">
                  {c.back}
                </button>
              </div>
            </form>
          )}

          {shown && !previewing && (
            <div role="status" className="mt-4 space-y-2 text-body">
              {shown.ok ? (
                <p className="rounded-control bg-ok-wash px-4 py-2.5 text-ok">
                  {shown.preview
                    ? c.noneReady
                    : shown.added === 0 ? c.nothingNew : `${c.added} ${shown.added}`}
                  {shown.duplicates ? ` · ${shown.duplicates} ${c.duplicates}` : ''}
                </p>
              ) : (
                <p role="alert" className="rounded-control bg-bad-wash px-4 py-2.5 text-bad">{shown.error}</p>
              )}
              <Skipped report={shown} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Nothing was read into this cell. Hidden from a screen reader, which gets
 *  an empty cell instead of the word for a dash. */
const Blank = () => <span aria-hidden className="text-ink-mute">–</span>;

/** How many of each, before anything is written. */
function Counts({ report }: { report: ImportReport }) {
  const c = useCopy().guestImport;
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-body">
      <span className="text-ink">
        <span className="font-semibold tabular-nums">{report.ready}</span>{' '}
        <span className="text-ink-soft">{c.ready}</span>
      </span>
      {report.duplicates ? (
        <span className="text-ink-mute">
          <span className="tabular-nums">{report.duplicates}</span> {c.duplicates}
        </span>
      ) : null}
    </p>
  );
}

/** Who was set aside as already on the list.
 *
 *  The names and not only the count, because the rule has exactly one way to
 *  be wrong - two people genuinely called the same thing with no phone
 *  between them - and the price of it is a guest who silently never arrives.
 *  A number cannot be checked against anything and a name can. */
function Repeated({ names }: { names: string[] }) {
  const c = useCopy().guestImport;
  if (names.length === 0) return null;
  return (
    <details className="mt-3 rounded-control bg-surface-200 px-4 py-2.5 text-ink-soft">
      <summary className="cursor-pointer">{count(c.whoRepeated, names.length)}</summary>
      <ul className="mt-2 space-y-0.5 text-body">
        {names.map((n, i) => <li key={`${n}-${i}`}><Name>{n}</Name></li>)}
      </ul>
    </details>
  );
}

/** Line numbers, not a count. "398 of 400" is a mystery; "line 3 had no name"
 *  is something to go and fix. */
function Skipped({ report }: { report: ImportReport }) {
  const c = useCopy().guestImport;
  if (!report.skipped || report.skipped.length === 0) return null;
  return (
    <details className="mt-3 rounded-control bg-warn-wash px-4 py-2.5 text-warn">
      <summary className="cursor-pointer">{count(c.skipped, report.skipped.length)}</summary>
      <ul className="mt-2 space-y-0.5 text-body">
        {report.skipped.slice(0, 30).map((s) => (
          <li key={s.line}>{c.line} {s.line}: {s.reason}</li>
        ))}
      </ul>
    </details>
  );
}
