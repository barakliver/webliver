'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, TriangleAlert, X } from 'lucide-react';
import { assignCrew, unassignCrew } from '@/app/actions/crewMembers';
import { crewState, CREW_SLOTS, type CrewSlot } from '@/lib/crewNeeds';
import { useCopy } from '@/components/app/CopyProvider';
import { Ltr } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';
import type { CrewPerson } from '@/components/app/CrewDesk';

export type BoardEvent = {
  id: string;
  name: string;
  date: string | null;
  /** The number the staffing rule is applied to, worked out on the server so
   *  the board and the event screen cannot disagree about it. */
  guests: number | null;
};

export type BoardAssignment = { clientId: string; memberId: string; slot: string | null };

/**
 * The season on one screen.
 *
 * Rows are the evenings ahead, columns are the three roles, and the people
 * are chips. What the board answers that no single event screen can: who is
 * doing four Saturdays in a row, and which evening in August still has
 * nobody running it.
 *
 * Two ways to move somebody, deliberately, and the same two targets take
 * both. Dragging is the one he asked for and it is the right gesture with a
 * mouse. It is also useless on a phone, where a long-press is the browser's
 * text selection and a drag is a scroll — and he works from a phone. So every
 * chip is also a button: press a person, press a cell, done. The press path
 * is the one that works with a keyboard and a screen reader too, which is why
 * it is the real implementation and the drag is the decoration on top of it.
 */
export function CrewBoard({
  events, people, assignments: initial,
}: {
  events: BoardEvent[];
  people: CrewPerson[];
  assignments: BoardAssignment[];
}) {
  const c = useCopy().crew;
  const locale = useCopy().locale;
  const [rows, setRows] = useState<BoardAssignment[]>(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [, start] = useTransition();

  const labels: Record<CrewSlot, string> = {
    manager: c.slotManager, assistant: c.slotAssistant, social: c.slotSocial,
  };
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, day: 'numeric', month: 'short', year: 'numeric',
  });

  const live = people.filter((p) => !p.archived_at);
  const nameOf = (id: string) => live.find((p) => p.id === id)?.name ?? '';

  /* The board moves first and the server catches up. A staffing screen that
     waits a round trip per drag is a screen somebody drags twice. */
  function place(clientId: string, memberId: string, slot: CrewSlot) {
    setRows((r) => [
      ...r.filter((x) => !(x.clientId === clientId && x.memberId === memberId)),
      { clientId, memberId, slot },
    ]);
    setPicked(null);
    const form = new FormData();
    form.set('client_id', clientId);
    form.set('member_id', memberId);
    form.set('slot', slot);
    start(() => { void assignCrew(form); });
  }

  function lift(clientId: string, memberId: string) {
    setRows((r) => r.filter((x) => !(x.clientId === clientId && x.memberId === memberId)));
    const form = new FormData();
    form.set('client_id', clientId);
    form.set('member_id', memberId);
    start(() => { void unassignCrew(form); });
  }

  /** How many evenings each person is on, across the whole board. The one
   *  number the season view exists to show. */
  const load = (id: string) => rows.filter((r) => r.memberId === id).length;

  if (events.length === 0) {
    return <p className="text-[14px] text-ink-mute">{c.boardNoEvents}</p>;
  }

  return (
    <div className="space-y-5">
      {/* The pool. Pressing somebody picks them up; pressing again puts them
          down, so there is never a state somebody is stuck in. */}
      <div>
        <p className="eyebrow">{c.boardPool}</p>
        <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
          {live.map((p) => {
            const on = picked === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                  onClick={() => setPicked(on ? null : p.id)}
                  aria-pressed={on}
                  aria-label={`${on ? c.boardCancel : c.boardPick}: ${p.name}`}
                  className={`inline-flex cursor-grab items-center gap-2 rounded-xl2 border px-3 py-2 text-[14px] transition-colors ${
                    on
                      ? 'border-accent bg-accent-wash text-ink'
                      : 'border-line-soft bg-card text-ink-soft hover:border-accent/40'
                  }`}
                >
                  {p.name}
                  <span className="tabular-nums text-[12px] text-ink-mute"><Ltr>{String(load(p.id))}</Ltr></span>
                </button>
              </li>
            );
          })}
        </ul>
        {picked && (
          <p role="status" className="mt-2 text-[13px] text-accent">{c.boardPicked}</p>
        )}
      </div>

      {/* One row per evening. A table on a wide screen and stacked cards on a
          phone, which is the same information and not the same shape. */}
      <div className="overflow-x-auto">
        <ul className="list-none space-y-3 p-0">
          {events.map((ev) => {
            const here = rows.filter((r) => r.clientId === ev.id);
            const { slots, short } = crewState(ev.guests, here);
            return (
              <li key={ev.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h4 className="font-display text-[16.5px] font-semibold text-ink">
                    <Link href={`/app/clients/${ev.id}`} className="transition-colors hover:text-accent">
                      {ev.name}
                    </Link>
                  </h4>
                  <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-ink-mute">
                    <span>{ev.date ? fmt.format(new Date(ev.date)) : c.shiftNoDate}</span>
                    {ev.guests !== null && (
                      <span><Ltr>{String(ev.guests)}</Ltr> {c.boardGuests}</span>
                    )}
                    {short > 0 ? (
                      <span className="inline-flex items-center gap-1 text-bad">
                        <TriangleAlert size={13} aria-hidden strokeWidth={1.5} />
                        {c.boardShort}: <Ltr>{String(short)}</Ltr>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-good">
                        <Check size={13} aria-hidden strokeWidth={1.5} />{c.boardFull}
                      </span>
                    )}
                  </p>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {CREW_SLOTS.map((slot) => {
                    const inSlot = here.filter((r) => r.slot === slot);
                    const state = slots.find((s) => s.slot === slot)!;
                    return (
                      <div
                        key={slot}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData('text/plain');
                          if (id) place(ev.id, id, slot);
                        }}
                        className={`rounded-xl2 border p-2.5 ${
                          state.short > 0 ? 'border-bad/30 bg-bad-wash/40' : 'border-line-soft bg-surface-100'
                        }`}
                      >
                        <p className="text-[12.5px] text-ink-mute">
                          {labels[slot]}
                          {state.need > 0 && <> · <Ltr>{`${state.filled}/${state.need}`}</Ltr></>}
                        </p>

                        <ul className="mt-2 list-none space-y-1.5 p-0">
                          {inSlot.map((r) => (
                            <li key={r.memberId} className="flex items-center justify-between gap-2 rounded-xl2 bg-card px-2.5 py-1.5">
                              <span className="min-w-0 truncate text-[13.5px] text-ink">{nameOf(r.memberId)}</span>
                              <button
                                type="button"
                                onClick={() => lift(ev.id, r.memberId)}
                                aria-label={`${c.boardRemove}: ${nameOf(r.memberId)}`}
                                className="shrink-0 rounded-full p-1 text-ink-mute transition-colors hover:bg-surface-200 hover:text-bad"
                              >
                                <X size={13} aria-hidden strokeWidth={1.5} />
                              </button>
                            </li>
                          ))}
                        </ul>

                        {/* The drop target, which is also the press target.
                            It only offers itself when somebody is in hand, so
                            the board is not a grid of empty buttons at rest. */}
                        {picked ? (
                          <button
                            type="button"
                            onClick={() => place(ev.id, picked, slot)}
                            className="mt-2 w-full rounded-xl2 border border-dashed border-accent/50 px-2 py-1.5
                                       text-[12.5px] text-accent transition-colors hover:bg-accent-wash"
                          >
                            {c.boardPlace}
                          </button>
                        ) : inSlot.length === 0 ? (
                          <p className="mt-2 text-[12.5px] text-ink-mute">{c.boardEmpty}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
