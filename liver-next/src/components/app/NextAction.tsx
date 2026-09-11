import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check } from 'lucide-react';
import { Money } from '@/components/Ltr';
import { formatDate } from '@/lib/dates';
import { shortDate } from '@/lib/appDates';
import { fill } from '@/lib/copyText';
import type { AppUi } from '@/content/appUi';
import type { NextAction as Action, TaskFact } from '@/lib/nextAction';

/**
 * One thing to do, at the top of the couple's screen.
 *
 * The dashboard had a countdown, sixteen rows of figures and eleven panels,
 * and none of it answered the question a couple actually opens the app with.
 * A large number is not an instruction: it says you are behind without saying
 * on what, and the only thing it invites is to feel bad about it.
 *
 * So: one action, the date it is due, one sentence saying why it is that one,
 * and a button that goes to the panel where it is done. Everything about
 * which action lives in lib/nextAction and is arithmetic over rows the couple
 * can see for themselves — no model, nothing invented, and a rule that can be
 * checked rather than trusted.
 *
 * "Everything handled" is a real answer and is drawn as one. A screen that
 * manufactures a least-important thing to nag about on a quiet week is a
 * screen people stop reading.
 *
 * Under it, the two or three after it, so the couple can see what is coming
 * without opening the list. The action itself is not repeated there.
 */
export function NextAction({ action, then, ui, moneyOn }: {
  action: Action;
  /** The tasks after this one, already excluding it. */
  then: TaskFact[];
  ui: AppUi;
  /** Amounts are drawn only where the couple was sold the money module. */
  moneyOn: boolean;
}) {
  const c = ui.portal.next;
  const dateFmt = shortDate(ui.locale);
  const say = c.say[action.code];
  const head = fill(say.head, { s: action.subject });
  const why = fill(say.why, { n: action.n });
  const done = action.code === 'clear';
  const money = moneyOn && (action.code === 'payLate' || action.code === 'paySoon') && action.n > 0;

  return (
    <section
      aria-labelledby="next-title"
      className={`card mt-8 ${action.late ? 'border-bad/30' : ''}`}
    >
      <p id="next-title" className="eyebrow">{c.title}</p>

      {/* Stacked on a phone. Side by side the button is shrink-0 and the
          headline loses half its width to it, which turned four words into
          three lines on the screen this is most often read on. */}
      <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-x-6">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-start gap-2.5 font-display text-[22px] font-semibold leading-snug text-ink sm:text-[26px]">
            {done && <Check size={22} aria-hidden strokeWidth={1.5} className="mt-1 shrink-0 text-ok" />}
            <span className="min-w-0">{head}</span>
          </h2>

          <p className="mt-2 max-w-prose2 text-[15px] leading-relaxed text-ink-soft">{why}</p>

          {/* The date and the amount as their own marks rather than inside
              the sentence, so the formatter that draws every other figure in
              the app draws these too and a Hebrew paragraph never has a
              hand-built number in the middle of it. */}
          {(action.due || money || (action.code === 'taskLate' && action.n > 1)) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-ink-mute">
              {action.due && (
                <span className={`inline-flex items-center gap-1.5 ${action.late ? 'font-semibold text-bad' : ''}`}>
                  <CalendarDays size={14} aria-hidden strokeWidth={1.5} />
                  {action.late ? c.late : c.by} {formatDate(dateFmt, action.due, c.noDue)}
                </span>
              )}
              {money && <Money value={action.n} className="text-ink" />}
              {action.code === 'taskLate' && action.n > 1 && (
                <span>{fill(c.moreTasks, { n: action.n - 1 })}</span>
              )}
            </p>
          )}
        </div>

        {/* Nowhere to send somebody whose week is clear. The button appears
            when there is something at the other end of it. */}
        {!done && (
          <Link href={`#${action.section}`} className="btn-primary w-full sm:w-auto sm:shrink-0">
            {c.go[action.section]}
            <ArrowLeft size={16} aria-hidden strokeWidth={1.5} className="chev-onward" />
          </Link>
        )}
      </div>

      {then.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-[12.5px] text-ink-mute">{c.also}</p>
          <ul className="mt-2 list-none space-y-1.5 p-0">
            {then.map((t) => (
              <li key={`${t.title}-${t.due_on ?? ''}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="min-w-0 text-[14.5px] text-ink">{t.title}</span>
                <span className="shrink-0 text-[12.5px] text-ink-mute">
                  {formatDate(dateFmt, t.due_on, c.noDue)}
                  {' · '}
                  {t.owner === 'client' ? c.ownerUs : c.ownerProducer}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
