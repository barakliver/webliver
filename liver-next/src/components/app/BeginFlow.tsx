'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { saveBasics, type OnboardResult } from '@/app/actions/onboarding';
import { remaining, MAX_MUST, type EventBasics, type Question } from '@/lib/onboarding';
import { PLAN_CATEGORIES, type PlanCategory } from '@/lib/budgetPlan';

/**
 * The five questions, asked once.
 *
 * A couple invited onto an event arrives at a screen that knows their names
 * and nothing else, and everything on it is a panel waiting for a number
 * somebody has to type. This asks for the five that unlock the rest — when,
 * how many, roughly where, what figure, and what they will not compromise on
 * — and then puts three things on their list.
 *
 * Three rules it keeps, each of them the reason a flow like this usually
 * fails.
 *
 * It asks only about blanks. A date the producer already agreed with a hall
 * is not a question, and the database refuses to overwrite one anyway, so the
 * screen and the fence say the same thing.
 *
 * Every question can be skipped, including the first. "We have not decided"
 * is the commonest answer about a wedding date on the first call, and a flow
 * that will not move past it is a flow abandoned by the couples who most
 * need what is on the other side.
 *
 * And it is dismissible. It sits above the dashboard rather than in front of
 * it: somebody who opened the app to check a payment should not have to
 * answer five questions to reach it.
 */
export function BeginFlow({ clientId, basics, defaultOpen = false }: {
  clientId: string;
  basics: EventBasics;
  /** Open on arrival. The gallery uses it; the real screen waits to be asked. */
  defaultOpen?: boolean;
}) {
  const ui = useCopy();
  const c = ui.portal.begin;
  const steps = remaining(basics);

  const [open, setOpen] = useState(defaultOpen);
  const [at, setAt] = useState(0);
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('');
  const [region, setRegion] = useState('');
  const [budget, setBudget] = useState('');
  const [must, setMust] = useState<PlanCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<OnboardResult | null>(null);

  if (steps.length === 0) return null;

  if (done?.ok) {
    const names = (done.wrote ?? []).map((k) => c.wrote[k as keyof typeof c.wrote]).filter(Boolean);
    return (
      <section className="card mt-8 border-ok/30">
        <h2 className="flex items-center gap-2.5 font-display text-[20px] font-semibold text-ink">
          <Check size={20} aria-hidden strokeWidth={1.5} className="shrink-0 text-ok" />
          {c.doneTitle}
        </h2>
        {names.length > 0 && (
          <p className="mt-2 text-[14.5px] text-ink-soft">{names.join(' · ')}</p>
        )}
        <p className="mt-2 text-[14.5px] text-ink-soft">
          {done.tasks ? fill(c.doneTasks, { n: done.tasks }) : c.doneNone}
        </p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="card mt-8">
        <h2 className="flex items-center gap-2.5 font-display text-[20px] font-semibold text-ink">
          <Sparkles size={19} aria-hidden strokeWidth={1.5} className="shrink-0 text-accent" />
          {c.title}
        </h2>
        <p className="mt-2 max-w-prose2 text-[14.5px] leading-relaxed text-ink-soft">{c.sub}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(true)} className="btn-primary">{c.open}</button>
        </div>
      </section>
    );
  }

  const step = steps[at];
  const last = at === steps.length - 1;

  const toggle = (k: PlanCategory) =>
    setMust((m) => (m.includes(k) ? m.filter((x) => x !== k) : m.length >= MAX_MUST ? m : [...m, k]));

  const finish = async () => {
    setBusy(true);
    const res = await saveBasics({
      clientId,
      date: date || null,
      guests: guests ? Number(guests) : null,
      region,
      budget: budget ? Number(budget) : null,
      must,
    });
    setBusy(false);
    setDone(res);
  };

  const onward = () => { if (last) void finish(); else setAt((i) => i + 1); };

  return (
    <section className="card mt-8" aria-labelledby="begin-title">
      <p className="eyebrow">{fill(c.of, { n: at + 1, of: steps.length })}</p>
      <h2 id="begin-title" className="mt-2 font-display text-[22px] font-semibold text-ink">
        {c.q[step].head}
      </h2>
      <p className="mt-1.5 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.q[step].hint}</p>

      <div className="mt-5">
        <Field
          step={step} c={c}
          date={date} setDate={setDate}
          guests={guests} setGuests={setGuests}
          region={region} setRegion={setRegion}
          budget={budget} setBudget={setBudget}
          must={must} toggle={toggle}
          labels={ui.money.plan.categories}
        />
      </div>

      {done && !done.ok && (
        <p role="alert" className="mt-4 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {done.error ?? c.failed}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {at > 0 && (
          <button type="button" onClick={() => setAt((i) => i - 1)} className="btn-quiet px-3 text-[14px]">
            {c.back}
          </button>
        )}
        {/* Skipping is a real answer and stays one press away, on every
            question including the first. */}
        <button type="button" onClick={onward} disabled={busy} className="btn-quiet px-3 text-[14px]">
          {c.skip}
        </button>
        <button type="button" onClick={onward} disabled={busy} className="btn-primary ms-auto">
          {busy ? c.saving : last ? c.finish : c.next}
        </button>
      </div>
    </section>
  );
}

function Field({ step, c, date, setDate, guests, setGuests, region, setRegion, budget, setBudget, must, toggle, labels }: {
  step: Question;
  c: ReturnType<typeof useCopy>['portal']['begin'];
  date: string; setDate: (v: string) => void;
  guests: string; setGuests: (v: string) => void;
  region: string; setRegion: (v: string) => void;
  budget: string; setBudget: (v: string) => void;
  must: PlanCategory[]; toggle: (k: PlanCategory) => void;
  labels: Record<string, string>;
}) {
  if (step === 'date') {
    return (
      <input
        type="date" value={date} onChange={(e) => setDate(e.target.value)}
        aria-label={c.q.date.head} className="field sm:w-[220px]"
      />
    );
  }
  if (step === 'guests') {
    return (
      <input
        type="number" inputMode="numeric" min="1" max="5000"
        value={guests} onChange={(e) => setGuests(e.target.value)}
        placeholder={c.q.guests.ph} aria-label={c.q.guests.head} className="field sm:w-[220px]"
      />
    );
  }
  if (step === 'region') {
    return (
      <input
        value={region} onChange={(e) => setRegion(e.target.value)} maxLength={80}
        placeholder={c.q.region.ph} aria-label={c.q.region.head} className="field sm:w-[320px]"
      />
    );
  }
  if (step === 'budget') {
    return (
      <input
        type="number" inputMode="numeric" min="0"
        value={budget} onChange={(e) => setBudget(e.target.value)}
        placeholder={c.q.budget.ph} aria-label={c.q.budget.head} className="field sm:w-[220px]"
      />
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {PLAN_CATEGORIES.filter((k) => k !== 'contingency' && k !== 'other').map((k) => {
        const on = must.includes(k);
        return (
          <button
            key={k} type="button" onClick={() => toggle(k)} aria-pressed={on}
            className={`min-h-[44px] rounded-button border px-4 text-[14px] transition ${
              on
                ? 'border-accent bg-accent-wash text-ink'
                : 'border-line-strong bg-card text-ink-soft hover:border-accent/40 hover:text-ink'
            }`}
          >
            {labels[k] ?? k}
          </button>
        );
      })}
    </div>
  );
}
