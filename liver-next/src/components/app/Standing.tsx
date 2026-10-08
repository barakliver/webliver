import { Check, Clock } from 'lucide-react';
import { dayMonth } from '@/lib/appDates';
import { fill } from '@/lib/copyText';
import type { AppUi } from '@/content/appUi';
import type { Standing as Verdict } from '@/lib/standing';

/**
 * One sentence saying where the couple stands, under their countdown.
 *
 * The screen answered two questions well and never the third. The count says
 * how long is left and the card under it says what to do next; nothing on it
 * ever said that they are fine. A screen that only lists what is open teaches
 * somebody that opening it produces work, and a screen like that gets opened
 * less and less.
 *
 * So it sits in the header object rather than in a card of its own, directly
 * under the number, because it is the answer to that number and not a fourth
 * thing to read. "87 ימים" is the fear; this is the reply. It is also the
 * reason it is never absent: a band that appears only when the news is good
 * is a band nobody believes the next time it is there.
 *
 * Nothing here is red. Being behind is said in words and the alarm stays with
 * the action card above, which already borders red and names the one thing
 * that is late. Two red surfaces stacked is a screen shouting at a couple
 * about one overdue task.
 *
 * Every word of the verdict comes out of `lib/standing`, which is arithmetic
 * over rows they can see for themselves.
 */
export function Standing({ s, ui }: { s: Verdict; ui: AppUi }) {
  const c = ui.portal.standing;
  const say = c.say[s.code];
  const fmt = dayMonth(ui.locale);

  /* The quiet sentence is concrete rather than merely reassuring: it names
     the next date. With nothing dated left at all there is no date to name,
     and saying so is the honest version of the same news. */
  const why = s.code !== 'calm' ? say.why
    : s.nextOn ? fill(say.why, { d: fmt.format(new Date(`${s.nextOn}T12:00:00Z`)) })
    : c.calmClear;

  /* A tick is a claim, so only the verdicts that earn one get it. "No date
     yet" and "nothing is scheduled yet" are statements of fact about a couple
     who has not done anything wrong and not done anything either; a green
     check beside them reads as congratulation for a blank page, which is the
     kind of praise that teaches somebody the screen is not paying attention.
     Being behind gets a clock rather than a warning: the alarm belongs to the
     action card above, which is already red and already names the thing. */
  const Mark = s.code === 'behind' ? Clock
    : s.code === 'dateless' || s.code === 'fresh' ? null
    : Check;

  return (
    <div className="border-t border-line-soft bg-surface-100 px-5 py-4 sm:px-8">
      <p className="flex items-start justify-center gap-2 text-center">
        {Mark && (
          <Mark
            size={16} strokeWidth={1.75} aria-hidden
            className={`mt-[3px] shrink-0 ${s.code === 'behind' ? 'text-ink-soft' : 'text-ok'}`}
          />
        )}
        <span className="font-medium text-ink">{say.head}</span>
      </p>
      <p className="mx-auto mt-1 max-w-prose2 text-center text-meta leading-relaxed text-ink-mute">
        {why}
      </p>
    </div>
  );
}
