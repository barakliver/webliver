'use client';

import { useEffect, useState } from 'react';
import { hhmm } from '@/lib/runsheet';
import { EVENT_ZONE } from '@/lib/clock';

/**
 * The evening, as a line down the page - and on the day itself, a marker that
 * moves with the clock.
 *
 * Before the day it is a list. On the day it knows which moment is under way
 * and which is next, which is the one question a guest standing in a car park
 * actually has. The clock is read after the page has hydrated and never during
 * it, so the server and the client draw the same list and the marker arrives a
 * moment later; and it is read in Israel's zone, because the wedding is on the
 * fifth there and not wherever the phone happens to be.
 */
const nowIn = (zone: string): { day: string; min: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, min: Number(get('hour')) * 60 + Number(get('minute')) };
};

const minutesOf = (at: string): number => {
  const [h, m] = hhmm(at).split(':');
  return Number(h) * 60 + Number(m);
};

export function LiveMoments({ moments, eventDate, labels }: {
  moments: { at: string; title: string }[];
  eventDate: string | null;
  labels: { now: string; next: string };
}) {
  const [at, setAt] = useState<{ day: string; min: number } | null>(null);
  useEffect(() => {
    const tick = () => setAt(nowIn(EVENT_ZONE));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  /* Times after midnight belong to the same evening: a sequence that goes
     down is carried into the next day by adding one. */
  let carry = 0;
  let prev = -1;
  const mins = moments.map((m) => {
    const v = minutesOf(m.at);
    if (prev >= 0 && v < prev) carry += 1440;
    prev = v;
    return v + carry;
  });

  const live = at !== null && eventDate !== null && at.day === eventDate;
  let current = -1;
  if (live) mins.forEach((v, i) => { if (v <= at.min) current = i; });
  const next = live && current + 1 < moments.length ? current + 1 : -1;

  return (
    <ol className="relative mx-auto mt-5 max-w-sm list-none p-0 ps-8 before:absolute before:inset-y-3 before:start-[11px] before:w-px before:bg-line-strong">
      {moments.map((m, i) => (
        <li key={i} className="reveal relative flex items-baseline gap-5 py-3 text-head">
          <span
            aria-hidden
            className={`absolute -start-8 top-[1.15rem] size-[23px] rounded-full border-4 border-surface ${
              i === current ? 'bg-ink shadow-[0_0_0_6px_rgb(var(--ink-rgb)/.16)]' : i < current ? 'bg-ink-mute' : 'bg-line-strong'
            }`}
          />
          <span className="w-[52px] shrink-0 font-display text-subhead font-normal tabular-nums text-ink" dir="ltr">
            {hhmm(m.at)}
          </span>
          <span className="min-w-0 flex-1 text-ink">{m.title}</span>
          {(i === current || i === next) && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-meta ${i === current ? 'bg-ink text-surface' : 'bg-surface-200 text-ink'}`}>
              {i === current ? labels.now : labels.next}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
