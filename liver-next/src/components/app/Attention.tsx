import Link from 'next/link';
import { CalendarClock, ChevronLeft, CircleCheck, CreditCard, Target, TriangleAlert } from 'lucide-react';
import type { AttentionItem } from '@/lib/attention';
import { serverCopy } from '@/lib/serverLocale';
import { cn } from '@/lib/utils';
import { TaskTick } from '@/components/app/TaskTick';

const ICON = {
  lead:    Target,
  task:    CircleCheck,
  payment: CreditCard,
  gap:     TriangleAlert,
  /* An event whose work has fallen behind where the date says it should be.
     A clock rather than another warning triangle: it is late, not wrong. */
  behind:  CalendarClock,
} as const;


export async function AttentionList({ items }: { items: AttentionItem[] }) {
  const c = (await serverCopy()).overview2;
  if (!items.length) {
    return (
      <div className="card flex items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-ok-wash text-ok">
          <CircleCheck size={22} strokeWidth={1.5} aria-hidden />
        </span>
        <div>
          <p className="font-display text-[19px] font-semibold text-ink">{c.clear}</p>
          <p className="text-[14px] text-ink-soft">{c.clearSub}</p>
        </div>
      </div>
    );
  }

  /* Long lists are the thing being avoided here, so the screen shows the top
     of the pile and says how much is underneath rather than printing all of
     it. Seven is about what fits before a page stops being scannable. */
  const shown = items.slice(0, 7);
  const rest = items.length - shown.length;

  /* min-w-0 on each row: a grid item defaults to min-width:auto and refuses to
     shrink below its content, so one long line pushes the page sideways
     instead of the text truncating as intended. */
  return (
    <ul className="grid list-none gap-2.5 p-0">
      {shown.map((it) => {
        const Icon = ICON[it.kind];
        const urgent = it.urgency === 'now';
        return (
          <li key={it.id} className="min-w-0">
            {/* The row is a box with a link stretched over it rather than a
                link wrapping everything, because one of the things in it is
                now a button. A button inside a link is a control the keyboard
                and the screen reader both have to guess about; a stretched
                link leaves the whole row clickable and lets the tick sit on
                top of it, which is what both of them expect. */}
            <div
              className="group relative flex items-center gap-3.5 rounded-xl2 border border-line bg-card
                         p-4 transition-colors duration-200 ease-out hover:border-accent
                         focus-within:border-accent"
            >
              <Link href={it.href} className="flex min-w-0 flex-1 items-center gap-3.5 after:absolute after:inset-0">
              <span
                aria-hidden
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                  urgent ? 'bg-bad-wash text-bad' : 'bg-accent-wash text-accent',
                )}
              >
                <Icon size={19} strokeWidth={1.5} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-medium text-ink">{it.title}</span>
                <span className="block truncate text-[13.5px] text-ink-soft">{it.detail}</span>
              </span>
              </Link>

              {/* Urgency is a word as well as a colour, so it survives
                  greyscale and colour blindness. */}
              <span className={urgent ? 'chip-bad' : 'chip-mute'}>
                {urgent ? c.now : c.soon}
              </span>

              {/* Finished, from here. Only on his own tasks: those are one
                  row and the tick means one thing. An overdue payment, an
                  unanswered enquiry and an event running behind each need a
                  different verb, and a dashboard is the wrong place to
                  decide that money arrived. */}
              {it.taskId && it.clientId && (
                <TaskTick taskId={it.taskId} clientId={it.clientId} label={it.title} />
              )}

              <ChevronLeft
                size={17}
                strokeWidth={1.5}
                aria-hidden
                className="chev-onward shrink-0 text-ink-mute transition-transform duration-200
                           group-hover:-translate-x-0.5"
              />
            </div>
          </li>
        );
      })}

      {rest > 0 && (
        <li className="pt-1 text-center text-[13.5px] text-ink-soft">
          ועוד {rest} {rest === 1 ? 'דבר' : 'דברים'}
        </li>
      )}
    </ul>
  );
}
