'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Lock, LockOpen, Wand2 } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { shortDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { buildRunOfShow, shiftSchedule, lockRunsheet, type ShowResult } from '@/app/actions/runOfShow';

/**
 * The producer's three controls over the run of show, above the sheet.
 *
 * Build it from the couple's wedding-day answers (and build it again
 * after they change one; lines typed by hand are never touched); move
 * everything after a time by some minutes, which is what a chuppah that
 * slipped a quarter of an hour asks for; and lock it two days out, so a
 * change after that is a numbered version the suppliers are told about.
 */
function Busy({ label, busy, className = 'btn-primary' }: { label: string; busy: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={`${className} whitespace-nowrap`} disabled={pending}>{pending ? busy : label}</button>;
}

export function RunOfShowTools({ clientId, answered, lockedAt, version }: {
  clientId: string;
  /** 0 to 1 of the wedding-day questionnaire, or null when untouched. */
  answered: number | null;
  lockedAt: string | null;
  version: number;
}) {
  const ui = useCopy();
  const c = ui.intake;
  const dateFmt = shortDate(ui.locale);
  const [built, build] = useActionState<ShowResult | null, FormData>(buildRunOfShow, null);
  const [shifted, shift] = useActionState<ShowResult | null, FormData>(shiftSchedule, null);
  const [locked, lock] = useActionState<ShowResult | null, FormData>(lockRunsheet, null);
  const isLocked = Boolean(lockedAt);

  const said = (r: ShowResult | null, ok: string) => r && (
    <p role={r.ok ? 'status' : 'alert'} className={`mt-2 text-meta ${r.ok ? 'text-ok' : 'text-bad'}`}>{r.ok ? ok : r.error}</p>
  );

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="head-panel inline-flex items-center gap-2"><Wand2 size={16} strokeWidth={1.5} aria-hidden className="text-accent" />{c.rosTitle}</h2>
          <p className="mt-1 text-body text-ink-soft">{c.rosSub}</p>
          <p className="mt-2 text-meta text-ink-mute">
            {answered === null ? c.rosNotStarted : fill(c.rosAnswered, { pct: Math.round(answered * 100) })}
            {' · '}
            <Link href={`/app/portal/questionnaire?w=${clientId}&form=wedding_day`} className="underline-offset-2 hover:underline">{c.dayTitle}</Link>
          </p>
        </div>
        <form action={lock} className="flex flex-col items-end gap-1">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="open" value={isLocked ? '1' : '0'} />
          <button type="submit" className="btn-quiet inline-flex items-center gap-1.5 text-body">
            {isLocked ? <LockOpen size={14} strokeWidth={1.5} aria-hidden /> : <Lock size={14} strokeWidth={1.5} aria-hidden />}
            {isLocked ? c.rosUnlock : c.rosLock}
          </button>
          <span className="text-meta text-ink-mute">
            {isLocked ? fill(c.rosLocked, { date: formatDate(dateFmt, lockedAt, ''), n: version }) : fill(c.rosVersion, { n: version })}
          </span>
          {said(locked, '')}
        </form>
      </div>
      {!isLocked && <p className="mt-2 text-micro text-ink-mute">{c.rosLockHint}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <form action={build}>
          <input type="hidden" name="client_id" value={clientId} />
          <Busy label={built?.ok ? c.rosRebuild : c.rosBuild} busy={c.rosBuilding} className={isLocked ? 'btn-quiet' : 'btn-primary'} />
          {said(built, fill(c.rosBuilt, { n: built?.added ?? 0 }))}
        </form>

        <form action={shift} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <label className="min-w-0">
            <span className="mb-1 block text-meta text-ink-soft">{c.rosShiftFrom}</span>
            <input name="from" className="field w-28" dir="ltr" placeholder="20:10" autoComplete="off" inputMode="numeric" required />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-meta text-ink-soft">{c.rosShiftBy}</span>
            <input name="minutes" type="number" className="field w-24" dir="ltr" min={-300} max={300} defaultValue={15} required />
          </label>
          <Busy label={c.rosShiftGo} busy={c.rosBuilding} className="btn-quiet" />
          {said(shifted, fill(c.rosShifted, { n: shifted?.added ?? 0 }))}
        </form>
      </div>
    </section>
  );
}
