'use client';

import { useTransition } from 'react';
import { Tag } from 'lucide-react';
import { setEventLabel, type ProducerLabel } from '@/app/actions/labels';
import { labelCopy as c } from '@/content/site';
import { cn } from '@/lib/utils';

/**
 * Putting one of the producer's own colours on this event.
 *
 * The colours were defined on the diary screen and had nowhere to be applied,
 * which made the whole taxonomy decoration: a producer could name "tastings"
 * orange and never mark anything as a tasting. This is the other end of it.
 *
 * Chips rather than a select, because the whole set is four or five items and
 * the colour is the thing being chosen — a dropdown would hide the swatches,
 * which are the only reason the labels are worth anything. Pressing the chip
 * that is already on clears it, so there is no separate "none" to hunt for
 * and no way to get stuck with a colour you cannot remove.
 */
export function EventTagPicker({ clientId, labels, current }: {
  clientId: string;
  labels: ProducerLabel[];
  current: string | null;
}) {
  const [pending, start] = useTransition();

  /* Nothing to choose from is not an empty control, it is no control: a
     producer who has not built a taxonomy should not be shown its skeleton. */
  if (labels.length === 0) return null;

  const set = (id: string) => {
    const fd = new FormData();
    fd.set('client_id', clientId);
    /* The chip that is already on clears it. */
    fd.set('label_id', id === current ? '' : id);
    start(() => { void setEventLabel(fd); });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', pending && 'opacity-60')}>
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
        <Tag size={13} strokeWidth={1.5} aria-hidden />
        {c.eventTag}
      </span>

      {labels.map((l) => {
        const on = l.id === current;
        return (
          <button
            key={l.id} type="button" onClick={() => set(l.id)}
            aria-pressed={on} disabled={pending}
            className={cn(
              'inline-flex min-h-[32px] items-center gap-1.5 rounded-xl2 border px-2.5 text-[12.5px] transition-colors',
              on ? 'border-transparent text-surface' : 'border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink',
            )}
            style={on ? { background: l.color } : undefined}
          >
            {!on && <span aria-hidden className="size-2 rounded-full" style={{ background: l.color }} />}
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
