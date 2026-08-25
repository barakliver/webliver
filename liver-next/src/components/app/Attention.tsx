import Link from 'next/link';
import { Target, CircleCheck, CreditCard, TriangleAlert, ChevronLeft } from 'lucide-react';
import type { AttentionItem } from '@/lib/attention';
import { appCopy } from '@/content/site';
import { cn } from '@/lib/utils';

const ICON = {
  lead:    Target,
  task:    CircleCheck,
  payment: CreditCard,
  gap:     TriangleAlert,
} as const;

const c = appCopy.overview2;

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <div className="card flex items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-ok-wash text-ok">
          <CircleCheck size={22} strokeWidth={1.9} aria-hidden />
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
            <Link
              href={it.href}
              className="group flex items-center gap-3.5 rounded-xl2 border border-line bg-card
                         p-4 shadow-soft transition duration-200 ease-out hover:shadow-lift"
            >
              <span
                aria-hidden
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                  urgent ? 'bg-bad-wash text-bad' : 'bg-bronze-wash text-bronze',
                )}
              >
                <Icon size={19} strokeWidth={1.9} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-medium text-ink">{it.title}</span>
                <span className="block truncate text-[13.5px] text-ink-soft">{it.detail}</span>
              </span>

              {/* Urgency is a word as well as a colour, so it survives
                  greyscale and colour blindness. */}
              <span className={urgent ? 'chip-bad' : 'chip-mute'}>
                {urgent ? c.now : c.soon}
              </span>

              <ChevronLeft
                size={17}
                strokeWidth={2}
                aria-hidden
                className="shrink-0 text-ink-mute transition-transform duration-200
                           group-hover:-translate-x-0.5"
              />
            </Link>
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
