'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, ChevronLeft, Lock } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { useWide } from '@/lib/useWide';
import { Ratio, Money } from '@/components/Ltr';
import { fill } from '@/lib/copyText';
import { cn } from '@/lib/utils';
import { INTAKE_KEY, type Chapter, type Question } from '@/content/intake';
import { answerFor, completeness, isAnswered, nextChapter, formOf, type Answer } from '@/lib/intake';
import { saveAnswer } from '@/app/actions/intake';

/**
 * The questionnaire, as a couple answers it.
 *
 * Six chapters as cards, each saying how far it is; a chapter is one
 * question per screen on a phone and a list on a desk; every answer is
 * saved on its own eight hundred milliseconds after the typing stops, so
 * a refresh loses nothing and nobody is asked to press save. The
 * "between us" chapter opens on a sentence saying the partner will not
 * read it, and its answers are written private by the action whatever
 * the screen sends.
 *
 * The same renderer draws the wedding-day questionnaire, which is why
 * nothing in here knows what a question means: it knows eleven kinds of
 * answer and draws the one the question asks for.
 */
const SAVE_AFTER = 800;
/** The going rate for a proper wedding in Israel, per guest, end to end.
 *  One figure, said in the hint and used in the sum, so they cannot differ. */
const PER_GUEST = 800;
const bucketOf = (sum: number): string =>
  sum < 100_000 ? 'lt100' : sum < 150_000 ? '100_150' : sum < 250_000 ? '150_250' : sum < 400_000 ? '250_400' : 'gt400';

export function Questionnaire({ clientId, viewerId, answers: given, locale, backHref = '/app/portal', formKey = INTAKE_KEY }: {
  clientId: string; viewerId: string; answers: Answer[]; locale: 'he' | 'en'; backHref?: string;
  /** Which questionnaire: the intake by default, or the wedding day. */
  formKey?: string;
}) {
  const c = useCopy().intake;
  const form = formOf(formKey);
  const wide = useWide();
  const t = (he: string, en: string) => (locale === 'en' ? en : he);

  const [answers, setAnswers] = useState(given);
  useEffect(() => { setAnswers(given); }, [given]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [q, setQ] = useState(0);
  const [intro, setIntro] = useState(false);
  const [finished, setFinished] = useState(false);
  const [state, setState] = useState<Record<string, 'saving' | 'saved' | 'failed'>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [, start] = useTransition();

  const total = useMemo(() => completeness(answers, undefined, form), [answers, form]);

  const write = useCallback((key: string, value: unknown) => {
    setAnswers((prev) => {
      const rest = prev.filter((a) => !(a.question_key === key && a.answered_by === viewerId));
      const ch = form.chapters.find((x) => x.questions.some((qq) => qq.key === key));
      return [...rest, { question_key: key, answered_by: viewerId, value, visibility: ch?.private ? 'private' : 'couple' }];
    });
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    setState((s) => ({ ...s, [key]: 'saving' }));
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      start(async () => {
        const f = new FormData();
        f.set('client_id', clientId);
        f.set('question_key', key);
        f.set('form_key', form.key);
        f.set('value', typeof value === 'string' ? value : JSON.stringify(value));
        const r = await saveAnswer(null, f);
        setState((s) => ({ ...s, [key]: r.ok ? 'saved' : 'failed' }));
      });
    }, SAVE_AFTER));
  }, [clientId, viewerId, form]);

  const open = (ch: Chapter) => {
    setChapter(ch);
    const firstOpen = ch.questions.findIndex((qq) => !isAnswered(answerFor(answers, qq.key, viewerId)?.value));
    setQ(firstOpen < 0 ? 0 : firstOpen);
    setIntro(Boolean(ch.private));
    setFinished(false);
  };

  const closeChapter = () => {
    setChapter(null);
    if (!nextChapter(answers, form)) setFinished(true);
  };

  /* ── the landing ──────────────────────────────────────────────────────── */
  if (finished) {
    return (
      <section className="card text-center">
        <Check size={28} strokeWidth={1.5} aria-hidden className="mx-auto text-ok" />
        <h2 className="head-panel mt-3">{c.done}</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-ink-soft">{c.doneSub}</p>
        <Link href={backHref} className="btn-primary mt-6 inline-flex">{c.backToPortal}</Link>
      </section>
    );
  }

  if (!chapter) {
    return (
      <section className="card">
        <h2 className="head-panel">{form.key === INTAKE_KEY ? c.title : c.dayTitle}</h2>
        <p className="mt-1 text-body text-ink-soft">{form.key === INTAKE_KEY ? c.sub : c.daySub}</p>
        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-line" role="presentation">
          <div className="h-full rounded-full bg-accent transition-[width] duration-slow" style={{ width: `${Math.round(total * 100)}%` }} />
        </div>
        <p className="mt-1 text-meta text-ink-mute">{fill(c.progress, { pct: Math.round(total * 100) })}</p>
        <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
          {form.chapters.map((ch) => {
            const share = completeness(answers, ch);
            const openN = ch.questions.filter((qq) => !isAnswered(answerFor(answers, qq.key, viewerId)?.value)).length;
            return (
              <li key={ch.key}>
                <button type="button" onClick={() => open(ch)}
                  className="flex min-h-[72px] w-full items-center gap-3 rounded-card-sm border border-line bg-card px-4 py-3 text-start transition-colors duration-touch hover:border-line-strong">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-body', share >= 1 ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-soft')}>
                    {share >= 1 ? <Check size={16} strokeWidth={1.5} aria-hidden /> : ch.key.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-lead font-medium text-ink">
                      {t(ch.he, ch.en)}
                      {ch.private && <Lock size={13} strokeWidth={1.5} aria-label={c.privateMark} className="text-ink-mute" />}
                    </span>
                    <span className="block text-meta text-ink-mute">
                      {share >= 1 ? c.chapterDone : fill(c.chapterOpen, { n: openN })} · {t(ch.minutesHe, ch.minutesEn)}
                    </span>
                  </span>
                  <span className="text-meta text-accent">{share > 0 && share < 1 ? c.continueCh : share >= 1 ? '' : c.start}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  /* ── the private chapter's door ───────────────────────────────────────── */
  if (intro) {
    return (
      <section className="card text-center">
        <Lock size={24} strokeWidth={1.5} aria-hidden className="mx-auto text-ink-mute" />
        <h2 className="head-panel mt-3">{t(chapter.he, chapter.en)}</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-ink-soft">{c.privateIntro}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className="btn-quiet" onClick={() => setChapter(null)}>{c.toChapters}</button>
          <button type="button" className="btn-primary" onClick={() => setIntro(false)}>{c.privateGo}</button>
        </div>
      </section>
    );
  }

  /* ── a chapter ────────────────────────────────────────────────────────── */
  const onePerScreen = wide === false;
  const shown = onePerScreen ? [chapter.questions[q]] : chapter.questions;
  const guestsRaw = answerFor(answers, 'b9_guests', viewerId)?.value;
  const guests = Number(guestsRaw) > 0 ? Math.round(Number(guestsRaw)) : null;
  const share = completeness(answers, chapter);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setChapter(null)} className="btn-quiet inline-flex items-center gap-1 px-0 text-body">
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="rtl:rotate-0 ltr:rotate-180" />{c.toChapters}
        </button>
        <span className="text-meta text-ink-mute">{t(chapter.he, chapter.en)} · {fill(c.progress, { pct: Math.round(share * 100) })}</span>
      </div>
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-line" role="presentation">
        <div className="h-full rounded-full bg-accent transition-[width] duration-slow" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>

      <ol className="mt-5 list-none space-y-8 p-0">
        {shown.map((qq) => {
          const mine = answers.find((a) => a.question_key === qq.key && a.answered_by === viewerId);
          const partner = chapter.private ? null : answers.find((a) => a.question_key === qq.key && a.answered_by !== viewerId && a.visibility === 'couple');
          const st = state[qq.key];
          return (
            <li key={qq.key}>
              <label className="block">
                <span className="block text-subhead font-normal leading-snug text-ink">
                  {onePerScreen && <span className="me-2 text-meta text-ink-mute"><Ratio of={q + 1} total={chapter.questions.length} /></span>}
                  {t(qq.he, qq.en)}
                </span>
                {(qq.hintHe || qq.hintEn) && <span className="mt-1 block text-body text-ink-soft">{t(qq.hintHe ?? '', qq.hintEn ?? '')}</span>}
                {chapter.private && <span className="mt-1 inline-flex items-center gap-1 text-meta text-ink-mute"><Lock size={12} strokeWidth={1.5} aria-hidden />{c.privateMark}</span>}
              </label>
              {/* The one sum a couple can check: their own guest count at the
                  going rate, and the range it lands in marked on the buttons. */}
              {qq.key === 'f34_budget' && guests !== null && (
                <p className="mt-2 text-body text-ink-soft">
                  {fill(c.budgetMath, { n: guests })} <Money value={guests * PER_GUEST} className="text-ink" />
                </p>
              )}
              <div className="mt-3">
                <Field q={qq} value={mine?.value} locale={locale} c={c} onChange={(v) => write(qq.key, v)}
                  suggest={qq.key === 'f34_budget' && guests !== null ? bucketOf(guests * PER_GUEST) : undefined} />
              </div>
              <div className="mt-1 flex items-center justify-between text-meta text-ink-mute">
                <span>{st === 'saving' ? c.saving : st === 'saved' ? c.saved : st === 'failed' ? <span className="text-bad">{c.saveFailed}</span> : ''}</span>
                {partner && isAnswered(partner.value) && !isAnswered(mine?.value) && (
                  <span>{c.partnerSaid}: {textOf(qq, partner.value, locale)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex items-center justify-between gap-3">
        {onePerScreen ? (
          <>
            <button type="button" className="btn-quiet inline-flex items-center gap-1" disabled={q === 0} onClick={() => setQ((k) => Math.max(0, k - 1))}>
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="ltr:rotate-180" />{c.back}
            </button>
            {q + 1 < chapter.questions.length ? (
              <span className="flex gap-2">
                <button type="button" className="btn-quiet" onClick={() => setQ((k) => k + 1)}>{c.skip}</button>
                <button type="button" className="btn-primary inline-flex items-center gap-1" onClick={() => setQ((k) => k + 1)}>
                  {c.next}<ChevronLeft size={16} strokeWidth={1.5} aria-hidden className="ltr:rotate-180" />
                </button>
              </span>
            ) : (
              <button type="button" className="btn-primary" onClick={closeChapter}>{c.finishChapter}</button>
            )}
          </>
        ) : (
          <>
            <span />
            <button type="button" className="btn-primary" onClick={closeChapter}>{c.finishChapter}</button>
          </>
        )}
      </div>
    </section>
  );
}

function textOf(q: Question, value: unknown, locale: 'he' | 'en'): string {
  if (typeof value === 'string') {
    const o = q.options?.find((x) => x.value === value);
    return o ? (locale === 'en' ? o.en : o.he) : value;
  }
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? textOf(q, v, locale) : typeof v === 'object' && v ? String((v as { name?: string }).name ?? '') : String(v))).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${textOf(q, k, locale)} ${String(v)}`).join(', ');
  return value === undefined || value === null ? '' : String(value);
}

/* ── one answer, by its kind ─────────────────────────────────────────────── */

type C = ReturnType<typeof useCopy>['intake'];
type Person = { name: string; relation: string; role: string };

function Field({ q, value, locale, c, onChange, suggest }: { q: Question; value: unknown; locale: 'he' | 'en'; c: C; onChange: (v: unknown) => void; suggest?: string }) {
  const t = (he: string, en: string) => (locale === 'en' ? en : he);
  const str = typeof value === 'string' ? value : value === undefined || value === null ? '' : typeof value === 'number' ? String(value) : '';

  switch (q.type) {
    case 'text':
      return <input className="field" defaultValue={str} onChange={(e) => onChange(e.target.value)} autoComplete="off" enterKeyHint="next" />;
    case 'number':
      return <input className="field w-40" type="number" min={0} inputMode="numeric" dir="ltr" defaultValue={str} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'date':
      return <input className="field w-48" type="date" defaultValue={str} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <input className="field w-36" type="time" dir="ltr" defaultValue={str} onChange={(e) => onChange(e.target.value)} />;
    case 'table': {
      const cols = q.columns ?? [];
      const list = Array.isArray(value) ? (value as Record<string, string>[]) : [];
      const blank = Object.fromEntries(cols.map((cc) => [cc.key, '']));
      const rows = list.length < (q.max ?? 6) ? [...list, blank] : list;
      const set = (k: number, key: string, v: string) => {
        const next = rows.map((r, i) => (i === k ? { ...r, [key]: v } : r));
        onChange(next.filter((r) => Object.values(r).some((x) => String(x ?? '').trim())));
      };
      return (
        <ul className="list-none space-y-2 p-0">
          {rows.map((r, k) => (
            <li key={k} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, minmax(0, 1fr))` }}>
              {cols.map((cc) => (
                <input key={cc.key} className="field" placeholder={t(cc.he, cc.en)} defaultValue={r[cc.key] ?? ''} autoComplete="off"
                  type={cc.kind === 'time' ? 'time' : cc.kind === 'number' ? 'number' : cc.kind === 'phone' ? 'tel' : 'text'}
                  dir={cc.kind === 'time' || cc.kind === 'number' || cc.kind === 'phone' ? 'ltr' : undefined}
                  inputMode={cc.kind === 'phone' ? 'tel' : cc.kind === 'number' ? 'numeric' : undefined}
                  onChange={(e) => set(k, cc.key, e.target.value)} />
              ))}
            </li>
          ))}
        </ul>
      );
    }
    case 'textarea':
      return <textarea className="field min-h-[96px]" defaultValue={str} onChange={(e) => onChange(e.target.value)} />;
    case 'date_range': {
      const v = (value && typeof value === 'object' ? value : {}) as { from?: string; to?: string };
      return (
        <div className="flex flex-wrap gap-3">
          <label className="min-w-0"><span className="mb-1 block text-meta text-ink-soft">{c.dateFrom}</span>
            <input type="date" className="field" defaultValue={v.from ?? ''} onChange={(e) => onChange({ ...v, from: e.target.value })} /></label>
          <label className="min-w-0"><span className="mb-1 block text-meta text-ink-soft">{c.dateTo}</span>
            <input type="date" className="field" defaultValue={v.to ?? ''} onChange={(e) => onChange({ ...v, to: e.target.value })} /></label>
        </div>
      );
    }
    case 'single':
      return (
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {q.options?.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={str === o.value} onClick={() => onChange(o.value)}
              className={cn('min-h-[44px] rounded-control border px-4 text-body transition-colors duration-touch',
                str === o.value ? 'border-accent bg-accent-wash text-accent' : suggest === o.value ? 'border-accent-line bg-card text-ink' : 'border-line bg-card text-ink hover:border-line-strong')}>
              {t(o.he, o.en)}
              {suggest === o.value && str !== o.value && <span className="ms-2 text-micro text-accent">{c.budgetSuggest}</span>}
            </button>
          ))}
        </div>
      );
    case 'multi': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((o) => {
            const on = list.includes(o.value);
            return (
              <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                className={cn('min-h-[44px] rounded-control border px-4 text-body transition-colors duration-touch',
                  on ? 'border-accent bg-accent-wash text-accent' : 'border-line bg-card text-ink hover:border-line-strong')}>
                {t(o.he, o.en)}
              </button>
            );
          })}
        </div>
      );
    }
    case 'scale': {
      const v = (value && typeof value === 'object' ? value : {}) as Record<string, number>;
      return (
        <ul className="list-none space-y-2 p-0">
          {q.items?.map((it) => (
            <li key={it.value} className="flex items-center justify-between gap-3">
              <span className="text-body text-ink">{t(it.he, it.en)}</span>
              <span className="flex gap-1" role="radiogroup" aria-label={t(it.he, it.en)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={v[it.value] === n} onClick={() => onChange({ ...v, [it.value]: n })}
                    className={cn('size-9 rounded-full border text-body tabular-nums transition-colors duration-touch',
                      v[it.value] === n ? 'border-accent bg-accent text-card' : (v[it.value] ?? 0) > n ? 'border-accent-line bg-accent-wash text-accent' : 'border-line text-ink-soft')}>
                    {n}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case 'rank': {
      const order = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <p className="mb-2 text-meta text-ink-mute">{c.rankHint}</p>
          <div className="flex flex-wrap gap-2">
            {q.options?.map((o) => {
              const at = order.indexOf(o.value);
              return (
                <button key={o.value} type="button" disabled={at >= 0} onClick={() => onChange([...order, o.value])}
                  className={cn('inline-flex min-h-[44px] items-center gap-2 rounded-control border px-4 text-body',
                    at >= 0 ? 'border-accent bg-accent-wash text-accent' : 'border-line bg-card text-ink hover:border-line-strong')}>
                  {at >= 0 && <span className="flex size-5 items-center justify-center rounded-full bg-accent text-micro text-card">{at + 1}</span>}
                  {t(o.he, o.en)}
                </button>
              );
            })}
          </div>
          {order.length > 0 && <button type="button" className="btn-quiet mt-2 px-0 text-meta" onClick={() => onChange([])}>{c.rankClear}</button>}
        </div>
      );
    }
    case 'list': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      const rows = list.length < (q.max ?? 5) ? [...list, ''] : list;
      return (
        <ul className="list-none space-y-2 p-0">
          {rows.map((v, k) => (
            <li key={k} className="flex gap-2">
              <input className="field" defaultValue={v} placeholder={`${k + 1}`} autoComplete="off"
                onChange={(e) => { const next = [...rows]; next[k] = e.target.value; onChange(next.filter((x) => x.trim())); }} />
            </li>
          ))}
        </ul>
      );
    }
    case 'people': {
      const list = Array.isArray(value) ? (value as Person[]) : [];
      const rows = list.length < (q.max ?? 6) ? [...list, { name: '', relation: '', role: '' }] : list;
      const set = (k: number, field: keyof Person, v: string) => {
        const next = rows.map((p, i) => (i === k ? { ...p, [field]: v } : p));
        onChange(next.filter((p) => p.name.trim()));
      };
      return (
        <ul className="list-none space-y-2 p-0">
          {rows.map((p, k) => (
            <li key={k} className="grid grid-cols-3 gap-2">
              <input className="field" placeholder={c.personName} defaultValue={p.name} autoComplete="off" onChange={(e) => set(k, 'name', e.target.value)} />
              <input className="field" placeholder={c.personRelation} defaultValue={p.relation} autoComplete="off" onChange={(e) => set(k, 'relation', e.target.value)} />
              <input className="field" placeholder={c.personRole} defaultValue={p.role} autoComplete="off" onChange={(e) => set(k, 'role', e.target.value)} />
            </li>
          ))}
        </ul>
      );
    }
    default:
      return null;
  }
}
