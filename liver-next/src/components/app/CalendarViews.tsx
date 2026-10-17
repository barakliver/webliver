'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCopy } from '@/components/app/CopyProvider';
import { cn } from '@/lib/utils';

/**
 * The diary drawn two ways, and the choice is the user's.
 *
 * The month is the right picture for "is that Thursday free"; the running
 * list is the right one for "what is coming up, in order". Neither is the
 * default for everybody, so both are drawn by the server and this only
 * chooses which of the two is visible, and remembers it. Two renderings of
 * the same rows rather than two queries: the month and the list cannot
 * disagree about what is on a day, because they are handed the same items.
 *
 * Both stay in the document and one is `hidden`, which keeps the state of
 * the open day's form and the links on the hidden one out of the tab order.
 * The month is what the server draws and what a first visit shows; a stored
 * choice of the list switches on the first client render, the same trade
 * the leads board makes for its own two views.
 */
const KEY = 'calendar-view';

export function CalendarViews({ month, agenda }: { month: ReactNode; agenda: ReactNode }) {
  const c = useCopy().calendar.views;
  const [view, setView] = useState<'month' | 'agenda'>('month');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === 'month' || v === 'agenda') setView(v);
    } catch { /* a browser that refuses storage keeps the month */ }
  }, []);
  /* A day link from the list opens that day's panel, which lives on the
     month. Following one while the list is showing would open it somewhere
     hidden, so a day in the address brings the month forward. */
  const day = useSearchParams().get('day');
  useEffect(() => { if (day) setView('month'); }, [day]);
  const pick = (v: 'month' | 'agenda') => {
    setView(v);
    try { window.localStorage.setItem(KEY, v); } catch { /* same */ }
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex gap-1 rounded-full bg-surface-200 p-1" role="group" aria-label={c.label}>
        {(['month', 'agenda'] as const).map((v) => (
          <button key={v} type="button" onClick={() => pick(v)} aria-pressed={view === v}
            className={cn('inline-flex min-h-[40px] items-center rounded-full px-5 text-body transition-colors duration-touch',
              view === v ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink')}>
            {c[v]}
          </button>
        ))}
      </div>
      <div hidden={view !== 'month'}>{month}</div>
      <div hidden={view !== 'agenda'}>{agenda}</div>
    </div>
  );
}
