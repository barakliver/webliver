'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Check, ChevronDown, Plus, Search, TriangleAlert, X } from 'lucide-react';
import { useDragOnto, Grip, Carried } from '@/components/app/DragOnto';
import {
  assignCrew, unassignCrew, setProducerFee, setCrewFee, type CrewMemberResult,
} from '@/app/actions/crewMembers';
import { crewState, candidatesFor, isSlot, CREW_SLOTS, type CrewSlot } from '@/lib/crewNeeds';
import { clashingMembers } from '@/lib/crewLoad';
import { useCopy } from '@/components/app/CopyProvider';
import { Ltr, Money } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';
import type { CrewPerson } from '@/components/app/CrewDesk';

export type BoardEvent = {
  id: string;
  name: string;
  date: string | null;
  /** The number the staffing rule is applied to, worked out on the server so
   *  the board and the event screen cannot disagree about it. */
  guests: number | null;
  /** The producer's own position on this evening, from `ledgerOf` on the
   *  server — the same arithmetic the money tab shows, so the two screens can
   *  never answer the question differently. */
  money: {
    /** Everything the couple has agreed to pay, arrived or not. */
    billed: number;
    /** Suppliers plus crew. */
    costs: number;
    /** Just the crew's share of it, which is the half this screen moves. */
    crew: number;
    /** Billed minus costs. Negative is a real answer and is shown as one. */
    margin: number;
    /** Costs recorded before anybody has been billed: the ordinary shape of
     *  an event three months out, not a business in trouble. */
    early: boolean;
    /** What the producer typed this event is worth, or null when the payment
     *  schedule is still answering. */
    fee: number | null;
  };
};

export type BoardAssignment = {
  clientId: string;
  memberId: string;
  slot: string | null;
  /** The crew row, so a cost can be corrected where it is read. */
  crewId?: string;
  /** What this person is paid for this evening. Null when nothing is agreed,
   *  which is a different thing from free. */
  fee?: number | null;
};

function Saving() {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost shrink-0 text-[12.5px]" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

/**
 * What the event is worth, typed on the row it decides.
 *
 * Not a second home for money: `ledgerOf` prefers this figure over the
 * payment schedule, and both this board and the money tab read `ledgerOf`, so
 * there is one answer to "what is this event worth" rather than two that
 * disagree by next week.
 */
function EventIncome({ clientId, fee }: { clientId: string; fee: number | null }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(setProducerFee, null);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="client_id" value={clientId} />
      <div>
        <label className="label text-[11.5px]" htmlFor={`inc-${clientId}`}>{c.incomeSet}</label>
        <input
          id={`inc-${clientId}`} name="producer_fee" type="number" min="0" step="500"
          defaultValue={fee === null ? '' : String(fee)}
          placeholder={c.incomePh} className="field w-32 text-[13px]" inputMode="numeric"
        />
      </div>
      <Saving />
      {state?.ok && (
        <span className="inline-flex items-center gap-1 pb-2 text-[12px] text-good">
          <Check size={12} aria-hidden strokeWidth={1.5} />{c.crewNoteSaved}
        </span>
      )}
      {state?.error && <span className="pb-2 text-[12px] text-bad">{state.error}</span>}
    </form>
  );
}

/**
 * One person's cost on one evening.
 *
 * The directory rate is the usual figure and this is the one that actually
 * applies tonight: a long evening, a favour, a different job. Editable here
 * because this is the screen the total is read on, and correcting a number
 * three screens away from where it looked wrong is how it stays wrong.
 */
function PersonFee({ row }: { row: BoardAssignment }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(setCrewFee, null);
  if (!row.crewId) return null;
  return (
    <form action={action} className="mt-1.5 flex flex-wrap items-end gap-1.5">
      <input type="hidden" name="crew_id" value={row.crewId} />
      <input type="hidden" name="client_id" value={row.clientId} />
      <input
        name="fee" type="number" min="0" step="50"
        defaultValue={row.fee ? String(row.fee) : ''}
        placeholder={c.fee} aria-label={c.fee}
        className="field w-24 text-[12.5px]" inputMode="numeric"
      />
      <Saving />
      {state?.ok && <Check size={12} aria-hidden strokeWidth={1.5} className="mb-2 text-good" />}
      {state?.error && <span className="mb-2 text-[12px] text-bad">{state.error}</span>}
    </form>
  );
}

/**
 * Every name, behind one chevron, per cell.
 *
 * The board could already take somebody from the pool at the top, which works
 * when the pool is four people and stops working at fifteen: the chip you want
 * is off the side of a phone. So each cell opens its own list — searchable,
 * everybody in it, the people who do that job first.
 *
 * It is also how a role gets more people than the rule asks for. There is no
 * separate "add a slot" control because there are no slots: a cell holds as
 * many people as are put in it, and the rule only ever says how many it
 * expects. Wanting a third assistant is just assigning a third assistant.
 */
function SlotPicker({
  label, people, onPick,
}: {
  label: string;
  people: CrewPerson[];
  onPick: (memberId: string) => void;
}) {
  const c = useCopy().crew;
  const [q, setQ] = useState('');

  const shown = q.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
    : people;

  return (
    <details className="group/pick mt-2">
      <summary
        className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-xl2
                   border border-dashed border-line px-2 py-1.5 text-[12.5px] text-ink-soft
                   transition-colors hover:border-accent/50 hover:text-accent
                   [&::-webkit-details-marker]:hidden"
      >
        <Plus size={13} aria-hidden strokeWidth={1.5} />
        {c.boardAdd}
        <ChevronDown
          size={13} aria-hidden strokeWidth={1.5}
          className="transition-transform duration-200 group-open/pick:rotate-180"
        />
      </summary>

      <div className="mt-2">
        {people.length > 5 && (
          <div className="relative">
            <Search
              size={13} strokeWidth={1.5} aria-hidden
              className="pointer-events-none absolute inset-y-0 my-auto start-2.5 text-ink-mute"
            />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)}
              aria-label={`${c.deskSearch}: ${label}`} placeholder={c.deskSearchPh}
              className="field ps-8 text-[13px] [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>
        )}

        {shown.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-mute">{c.deskNoMatch}</p>
        ) : (
          <ul className="mt-2 max-h-56 list-none space-y-1 overflow-y-auto p-0">
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onPick(p.id); setQ(''); }}
                  className="w-full rounded-xl2 px-2.5 py-1.5 text-start text-[13.5px] text-ink
                             transition-colors hover:bg-accent-wash"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * The season on one screen.
 *
 * Rows are the evenings ahead, columns are the three roles, and the people
 * are chips. What the board answers that no single event screen can: who is
 * doing four Saturdays in a row, and which evening in August still has
 * nobody running it.
 *
 * Two ways to move somebody, deliberately, and the same two targets take
 * both: press a person then press a cell, or drag them onto it.
 *
 * The drag is on pointer events through `useDragOnto`, which is the standing
 * rule for every drag in this app and is not a style preference: `dragstart`
 * never fires on a touch screen, so the HTML drag and drop API does nothing
 * at all on a phone. The seating plan shipped on it for months and was dead
 * on the one device it is used from, standing in a venue. `verify.mjs` fails
 * a build that carries `dataTransfer` for that reason, and it caught this
 * board doing exactly that — the comment here said the drag was decoration
 * over a press, and the code had written the decoration in the API that
 * breaks.
 *
 * The press path is still the real one: it is what works with a keyboard and
 * a screen reader, and it is what a finger gets.
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

  /* The drag, on pointer events. The zone id carries both halves of the
     target — which evening and which role — because a cell is only a cell
     inside its own row, and one string is what the helper hands back. */
  const drag = useDragOnto<string>({
    onDrop: (memberId, zone) => {
      const [clientId, slot] = zone.split('|');
      if (clientId && isSlot(slot)) place(clientId, memberId, slot);
    },
  });

  /* Worked out from the board's own state rather than passed in, so the mark
     appears the moment somebody is dropped onto a second event on the same
     night — which is exactly when it is worth seeing, rather than after a
     reload. */
  const doubled = clashingMembers(
    rows.map((r) => ({ clientId: r.clientId, memberId: r.memberId })),
    new Map(events.map((e) => [e.id, e.date] as const)),
  );
  const clashDays = new Set(
    rows.filter((r) => doubled.has(r.memberId))
      .map((r) => `${r.memberId}|${events.find((e) => e.id === r.clientId)?.date?.slice(0, 10) ?? ''}`),
  );

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
                {/* The grip lifts and the rest of the chip presses. A finger
                    landing anywhere but the grip is scrolling a long pool,
                    which is the one thing a drag must never break. */}
                <span
                  {...drag.row(p.id)}
                  className={`inline-flex items-center gap-1 rounded-xl2 border ps-1 pe-3 text-[14px] transition-colors ${
                    on
                      ? 'border-accent bg-accent-wash text-ink'
                      : doubled.has(p.id)
                        ? 'border-bad/40 bg-bad-wash text-ink'
                        : 'border-line-soft bg-card text-ink-soft hover:border-accent/40'
                  }`}
                >
                  <Grip label={`${c.boardPick}: ${p.name}`} {...drag.grip(p.id)} />
                  <button
                    type="button"
                    onClick={() => setPicked(on ? null : p.id)}
                    aria-pressed={on}
                    aria-label={`${on ? c.boardCancel : c.boardPick}: ${p.name}`}
                    className="inline-flex items-center gap-2 py-2"
                  >
                    {doubled.has(p.id) && (
                      <TriangleAlert size={13} aria-hidden strokeWidth={1.5} className="text-bad" />
                    )}
                    {p.name}
                    <span className="tabular-nums text-[12px] text-ink-mute"><Ltr>{String(load(p.id))}</Ltr></span>
                  </button>
                </span>
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

                {/* The money, beside the people it is mostly spent on. The
                    same three figures the money tab shows and from the same
                    function, so staffing an evening and reading what is left
                    of it are one glance rather than two screens. */}
                <dl className="mt-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-ink-mute">{c.moneyIn}</dt>
                    <dd className="text-ink"><Money value={ev.money.billed} /></dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-ink-mute">{c.moneyCrew}</dt>
                    <dd className="text-ink"><Money value={ev.money.crew} /></dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-ink-mute">{c.moneyOut}</dt>
                    <dd className="text-ink"><Money value={ev.money.costs} /></dd>
                  </div>
                  {/* A margin before anything is billed is not a loss, it is
                      an invoice nobody has raised yet. Saying "loss" there is
                      how somebody learns to stop reading this line. */}
                  {ev.money.fee === null && ev.money.billed > 0 && (
                    <div className="text-ink-mute">{c.incomeFromPlan}</div>
                  )}
                  {ev.money.early ? (
                    <div className="text-ink-mute">{c.moneyEarly}</div>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <dt className="text-ink-mute">{c.moneyMargin}</dt>
                      <dd className={ev.money.margin < 0 ? 'font-medium text-bad' : 'font-medium text-ink'}>
                        <Money value={ev.money.margin} />
                      </dd>
                    </div>
                  )}
                </dl>

                <EventIncome clientId={ev.id} fee={ev.money.fee} />

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {CREW_SLOTS.map((slot) => {
                    const inSlot = here.filter((r) => r.slot === slot);
                    const state = slots.find((s) => s.slot === slot)!;
                    return (
                      <div
                        key={slot}
                        {...drag.zone(`${ev.id}|${slot}`)}
                        className={`rounded-xl2 border p-2.5 transition-colors ${
                          drag.over === `${ev.id}|${slot}`
                            ? 'border-accent bg-accent-wash'
                            : state.short > 0
                              ? 'border-bad/30 bg-bad-wash/40'
                              : 'border-line-soft bg-surface-100'
                        }`}
                      >
                        <p className="text-[12.5px] text-ink-mute">
                          {labels[slot]}
                          {state.need > 0 && <> · <Ltr>{`${state.filled}/${state.need}`}</Ltr></>}
                        </p>

                        <ul className="mt-2 list-none space-y-1.5 p-0">
                          {inSlot.map((r) => (
                            <li
                              key={r.memberId}
                              className={`rounded-xl2 px-2.5 py-1.5 ${
                                clashDays.has(`${r.memberId}|${ev.date?.slice(0, 10) ?? ''}`)
                                  ? 'bg-bad-wash ring-1 ring-bad/30'
                                  : 'bg-card'
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] text-ink">
                                {clashDays.has(`${r.memberId}|${ev.date?.slice(0, 10) ?? ''}`) && (
                                  <TriangleAlert size={12} aria-hidden strokeWidth={1.5} className="shrink-0 text-bad" />
                                )}
                                {nameOf(r.memberId)}
                              </span>
                              <button
                                type="button"
                                onClick={() => lift(ev.id, r.memberId)}
                                aria-label={`${c.boardRemove}: ${nameOf(r.memberId)}`}
                                className="shrink-0 rounded-full p-1 text-ink-mute transition-colors hover:bg-surface-200 hover:text-bad"
                              >
                                <X size={13} aria-hidden strokeWidth={1.5} />
                              </button>
                              </span>
                              {/* The cost that actually applies tonight. The
                                  directory rate is the usual one; this is a
                                  long evening, a favour, a different job. */}
                              <PersonFee row={r} />
                            </li>
                          ))}
                        </ul>

                        {/* Two ways in, and they do not compete: the drop
                            target appears only while somebody is in hand, and
                            the chevron is always there for the other path. */}
                        {picked ? (
                          <button
                            type="button"
                            onClick={() => place(ev.id, picked, slot)}
                            className="mt-2 w-full rounded-xl2 border border-dashed border-accent/50 px-2 py-1.5
                                       text-[12.5px] text-accent transition-colors hover:bg-accent-wash"
                          >
                            {c.boardPlace}
                          </button>
                        ) : (
                          <SlotPicker
                            label={labels[slot]}
                            people={candidatesFor(
                              live.filter((p) => !here.some((r) => r.memberId === p.id)),
                              slot,
                            )}
                            onPick={(id) => place(ev.id, id, slot)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The season added up. One line, because the question it answers is
          one question: what does the whole year in front of me come to. */}
      {(() => {
        const t = events.reduce(
          (a, e) => ({
            billed: a.billed + e.money.billed,
            costs: a.costs + e.money.costs,
            margin: a.margin + e.money.margin,
          }),
          { billed: 0, costs: 0, margin: 0 },
        );
        if (t.billed === 0 && t.costs === 0) return null;
        return (
          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-t border-line pt-4 text-[14px]">
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-mute">{c.seasonIn}</dt>
              <dd className="text-ink"><Money value={t.billed} /></dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-mute">{c.seasonOut}</dt>
              <dd className="text-ink"><Money value={t.costs} /></dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-mute">{c.seasonMargin}</dt>
              <dd className={t.margin < 0 ? 'font-semibold text-bad' : 'font-semibold text-ink'}>
                <Money value={t.margin} />
              </dd>
            </div>
          </dl>
        );
      })()}

      {/* What the pointer is carrying, drawn at the pointer and out of hit
          testing so the document answers with the cell underneath. */}
      <Carried at={drag.at}>{drag.item ? nameOf(drag.item) : null}</Carried>
    </div>
  );
}
