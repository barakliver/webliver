'use client';

import { useState, useTransition } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { shortDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { INTAKE, type Question } from '@/content/intake';
import { answerText, completeness, gaps, isAnswered, type Answer } from '@/lib/intake';
import { saveIntakeNote, prepareMeeting } from '@/app/actions/intake';

/**
 * The couple, as the producer reads them.
 *
 * Not the questionnaire again: a card per chapter with the answers as
 * sentences, the two partners side by side where they answered alone,
 * the sensitivities set apart and marked, a private note beside any
 * answer, and the one-page brief. Where the two partners answered a
 * shared question differently the row says so, because that difference
 * is the thing to ask about in the first meeting.
 */
export type IntakeNote = { id: string; question_key: string; note: string; created_at: string };
export type PrivateProfile = { sensitivities: string; surprises: string; brief: string; brief_at: string | null } | null;

export function CoupleProfile({ clientId, answers, notes, priv, writers }: {
  clientId: string;
  answers: Answer[];
  notes: IntakeNote[];
  priv: PrivateProfile;
  /** Partner ids in a stable order, so "A" is the same person on every row. */
  writers: string[];
}) {
  const ui = useCopy();
  const c = ui.intake;
  const dateFmt = shortDate(ui.locale);
  const fmt = (iso: string | null) => formatDate(dateFmt, iso, '');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [said, setSaid] = useState<string | null>(null);

  const who = (id: string) => (writers.indexOf(id) === 1 ? c.partnerB : c.partnerA);
  const gapKeys = new Set(gaps(answers).map((g) => g.key));
  const share = completeness(answers);

  if (answers.length === 0) {
    return (
      <section className="card">
        <h2 className="head-panel">{c.profTitle}</h2>
        <p className="mt-2 text-body text-ink-mute">{c.profEmpty}</p>
      </section>
    );
  }

  const brief = (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="head-panel inline-flex items-center gap-2"><Sparkles size={16} strokeWidth={1.5} aria-hidden className="text-accent" />{c.briefTitle}</h2>
          {priv?.brief_at && <p className="mt-1 text-meta text-ink-mute">{fill(c.briefAt, { date: fmt(priv.brief_at) })}</p>}
        </div>
        <form action={(f) => start(async () => { const r = await prepareMeeting(null, f); setSaid(r.ok ? null : (r.error ?? c.saveFailed)); })}>
          <input type="hidden" name="client_id" value={clientId} />
          <button type="submit" className={priv?.brief ? 'btn-quiet' : 'btn-primary'} disabled={busy}>
            {busy ? c.briefMaking : priv?.brief ? c.briefRefresh : c.briefMake}
          </button>
        </form>
      </div>
      {said && <p role="alert" className="mt-3 text-body text-bad">{said}</p>}
      {priv?.brief ? (
        <div className="mt-4 whitespace-pre-wrap text-body leading-relaxed text-ink">{priv.brief}</div>
      ) : (
        <p className="mt-3 text-body text-ink-mute">{c.briefNone}</p>
      )}
    </section>
  );

  const row = (q: Question, rows: Answer[], privateChapter: boolean) => {
    const myNotes = notes.filter((n) => n.question_key === q.key);
    const open = noteFor === q.key;
    const answered = rows.filter((a) => isAnswered(a.value));
    return (
      <li key={q.key} className={cn('py-3', gapKeys.has(q.key) && 'rounded-card-sm bg-warn-wash px-3')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-meta text-ink-mute">{q.he}</p>
            {answered.length === 0 ? (
              <p className="text-body text-ink-mute">{c.notAnswered}</p>
            ) : privateChapter || answered.length > 1 ? (
              <div className={cn('mt-1 grid gap-3', answered.length > 1 && 'sm:grid-cols-2')}>
                {answered.map((a) => (
                  <p key={a.answered_by} className="text-body text-ink">
                    <span className="text-meta text-ink-mute">{who(a.answered_by)}: </span>{answerText(q, a.value)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-body text-ink">{answerText(q, answered[0].value)}</p>
            )}
            {gapKeys.has(q.key) && <p className="mt-1 text-meta text-warn">{c.gapsTitle}: {c.gapHint}</p>}
            {myNotes.map((n) => (
              <p key={n.id} className="mt-1 border-s-2 border-accent-line ps-2 text-meta text-ink-soft">{n.note} <span className="text-ink-mute">· {fmt(n.created_at)}</span></p>
            ))}
          </div>
          <button type="button" className="btn-quiet shrink-0 px-2 py-1 text-meta" onClick={() => setNoteFor(open ? null : q.key)}>{c.noteAdd}</button>
        </div>
        {open && (
          <form className="mt-2 flex gap-2" action={(f) => start(async () => { const r = await saveIntakeNote(null, f); if (r.ok) setNoteFor(null); else setSaid(r.error ?? c.saveFailed); })}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="question_key" value={q.key} />
            <input name="note" className="field" placeholder={c.notePh} autoComplete="off" required />
            <button type="submit" className="btn-primary whitespace-nowrap" disabled={busy}>{busy ? c.noteSaving : c.noteSave}</button>
          </form>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="head-panel">{c.profTitle}</h2>
        <p className="mt-1 text-body text-ink-soft">{c.profSub}</p>
        <p className="mt-2 text-meta text-ink-mute">{fill(c.profCompleteness, { pct: Math.round(share * 100) })}</p>
      </section>

      {brief}

      {priv && (priv.sensitivities || priv.surprises) && (
        <section className="card border-bad/30">
          <h2 className="head-section inline-flex items-center gap-2 text-bad"><Lock size={15} strokeWidth={1.5} aria-hidden />{c.sensitiveTitle}</h2>
          <p className="mt-1 text-meta text-ink-mute">{c.sensitiveHint}</p>
          {priv.sensitivities && <p className="mt-3 whitespace-pre-wrap text-body text-ink">{priv.sensitivities}</p>}
          {priv.surprises && (
            <>
              <h3 className="head-sub mt-4">{c.surprisesTitle}</h3>
              <p className="mt-1 whitespace-pre-wrap text-body text-ink">{priv.surprises}</p>
            </>
          )}
        </section>
      )}

      {INTAKE.map((ch) => (
        <section key={ch.key} className="card">
          <h2 className="head-section inline-flex items-center gap-2">
            {ch.private && <Lock size={15} strokeWidth={1.5} aria-hidden className="text-ink-mute" />}{ch.private ? c.betweenTitle : ch.he}
          </h2>
          {ch.private && <p className="mt-1 text-meta text-ink-mute">{c.betweenHint}</p>}
          <ul className="mt-2 list-none divide-y divide-line p-0">
            {ch.questions
              .filter((q) => !(ch.key === 'c' && q.key === 'c21_sensitivities') && q.key !== 'e31_surprise')
              .map((q) => row(q, answers.filter((a) => a.question_key === q.key), Boolean(ch.private)))}
          </ul>
        </section>
      ))}
    </div>
  );
}
