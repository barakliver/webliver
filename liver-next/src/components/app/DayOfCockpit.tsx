'use client';

import { useEffect, useState } from 'react';
import { Check, Phone, MessageCircle, Undo2 } from 'lucide-react';
import { appCopy } from '@/content/site';
import { markDayItem } from '@/app/actions/day';
import { hhmm, humanSpan } from '@/lib/runsheet';
import { placeLines, focus, relative, callSheet, dueSoon, isToday, type Line, type Caller, type Placed } from '@/lib/dayof';
import { normalizePhone, displayPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

const c = appCopy.dayOf;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

/**
 * The evening, on the producer's phone.
 *
 * The clock is the browser's rather than the server's, on purpose. This screen
 * is looked at while walking through a hall, the answer has to match the watch
 * on the wrist reading it, and a server in another timezone would quietly be
 * an hour out all night.
 *
 * The first paint deliberately has no clock at all. Rendering the server's
 * idea of "now" and then replacing it with the browser's is a hydration
 * mismatch and, worse, a half second where every line of the wedding is shown
 * in the wrong state. So the schedule renders plainly, and the live layer
 * arrives on mount.
 */
export function DayOfCockpit({
  clientId, eventDate, lines, crew, vendors,
}: {
  clientId: string;
  eventDate: string | null;
  lines: Line[];
  crew: Caller[];
  vendors: Caller[];
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    /* Half a minute. The screen is read, not watched, and a second-by-second
       tick would rerender the whole evening 3,600 times an hour to move a
       label that only changes every sixty. */
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const live = now !== null && isToday(eventDate, now);
  const placed = placeLines(lines, now ?? new Date(0), live);
  const { now: current, next } = focus(placed);
  const sheet = callSheet(crew, vendors);
  const arriving = dueSoon(sheet, now ?? new Date(0), live);
  const open = placed.filter((p) => p.state !== 'done').length;

  return (
    <div className="space-y-5">
      {now !== null && !live && (
        <p className="card text-[14px] text-ink-soft">{c.notToday}</p>
      )}

      {live && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Headline label={c.now} placed={current} fallback={c.nothingNow} tone="now" />
          <Headline label={c.next} placed={next} fallback={c.nothingNext} tone="next" />
        </div>
      )}

      {arriving.length > 0 && (
        <section className="card border-warn/40 bg-warn-wash">
          <h2 className="text-[13px] font-semibold text-warn">{c.people.dueSoon}</h2>
          <ul className="mt-2 list-none space-y-1 p-0 text-[15px] text-ink">
            {arriving.map((p) => (
              <li key={p.id}>
                <span className="font-semibold tabular-nums">{hhmm(p.call_time ?? '')}</span>
                {' · '}{p.name}
                {p.role && <span className="text-ink-soft"> · {p.role}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[19px] font-semibold text-ink">{c.schedule}</h2>
          <span className="text-[12.5px] text-ink-mute">{c.openCount(open)}</span>
        </div>

        <ul className="mt-4 list-none space-y-2 p-0">
          {placed.map((p) => <Row key={p.line.id} p={p} clientId={clientId} />)}
        </ul>
      </section>

      <People sheet={sheet} />
    </div>
  );
}

function Headline({ label, placed, fallback, tone }: {
  label: string; placed: Placed | null; fallback: string; tone: 'now' | 'next';
}) {
  return (
    <div className={cn('card', tone === 'now' && 'border-accent-soft bg-accent-wash')}>
      <div className="text-[12.5px] font-semibold text-ink-mute">{label}</div>
      {placed ? (
        <>
          <div className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
            {placed.line.title}
          </div>
          <div className="mt-1 text-[14px] text-ink-soft">
            <span className="tabular-nums">{hhmm(placed.line.at_time)}</span>
            {placed.inMinutes !== null && tone === 'next' && ` · ${relative(placed.inMinutes)}`}
            {placed.line.duration_min ? ` · ${humanSpan(placed.line.duration_min)}` : ''}
          </div>
        </>
      ) : (
        <div className="mt-1 text-[15px] text-ink-soft">{fallback}</div>
      )}
    </div>
  );
}

/** One line, sized for a thumb. The tick is the whole row's business, so it is
 *  a 44px control and not a checkbox somebody has to aim at in the dark. */
function Row({ p, clientId }: { p: Placed; clientId: string }) {
  const done = p.state === 'done';
  const late = p.state === 'late';
  const isNow = p.state === 'now';

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-3 transition-colors',
        isNow ? 'border-accent-soft bg-accent-wash'
          : late ? 'border-bad/30 bg-bad-wash'
          : done ? 'border-line bg-surface-100'
          : 'border-line bg-card',
      )}
    >
      <form action={markDayItem}>
        <input type="hidden" name="item_id" value={p.line.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="undo" value={done ? '1' : '0'} />
        <button
          type="submit"
          aria-label={done ? c.untick : c.tick}
          className={cn(
            'grid h-11 w-11 place-items-center rounded-full border transition-colors',
            done ? 'border-ok bg-ok text-surface' : 'border-line-strong text-ink-mute hover:text-ink',
          )}
        >
          {done ? <Undo2 size={18} aria-hidden /> : <Check size={18} aria-hidden />}
        </button>
      </form>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold tabular-nums text-ink">{hhmm(p.line.at_time)}</span>
          <span className={cn('text-[15px]', done ? 'text-ink-mute line-through' : 'text-ink')}>
            {p.line.title}
          </span>
          {late && <span className="chip-bad">{c.late}</span>}
          {isNow && <span className="chip-ok">{c.now}</span>}
        </div>
        {done && p.line.done_at && (
          <div className="mt-0.5 text-[12.5px] text-ink-mute">{c.doneAt(timeOf(p.line.done_at))}</div>
        )}
      </div>
    </li>
  );
}

function People({ sheet }: { sheet: Caller[] }) {
  if (sheet.length === 0) {
    return (
      <section className="card">
        <h2 className="font-display text-[19px] font-semibold text-ink">{c.people.title}</h2>
        <p className="mt-2 text-[15px] text-ink-mute">{c.people.empty}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-display text-[19px] font-semibold text-ink">{c.people.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.people.sub}</p>

      <ul className="mt-4 list-none space-y-2 p-0">
        {sheet.map((person) => {
          const e164 = normalizePhone(person.phone);
          return (
            <li key={`${person.kind}-${person.id}`} className="rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[15px] font-semibold tabular-nums text-ink">
                  {person.call_time ? hhmm(person.call_time) : c.people.noTime}
                </span>
                <span className="text-[15px] text-ink">{person.name}</span>
                <span className="chip-mute">{person.kind === 'crew' ? c.people.crew : c.people.vendor}</span>
                {person.role && <span className="text-[13.5px] text-ink-soft">{person.role}</span>}
              </div>

              {e164 && (
                /* Two ways to reach one person, because on the evening one of
                   them is always the wrong one: a supplier mid-set does not
                   pick up, and a driver on the road does not read. */
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`tel:${e164}`} className="btn-ghost px-4 text-[14px]">
                    <Phone size={16} aria-hidden /> {c.people.call}
                    <span className="text-ink-mute tabular-nums">{displayPhone(e164)}</span>
                  </a>
                  <a
                    href={`https://wa.me/${e164.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-4 text-[14px]"
                  >
                    <MessageCircle size={16} aria-hidden /> {c.people.whatsapp}
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
