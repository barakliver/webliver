'use client';

import { useEffect, useState } from 'react';
import { useScreenAwake } from '@/lib/awake';
import { Check, Megaphone, MessageCircle, Phone, Sun, Undo2, UserCheck, X } from 'lucide-react';
import { appCopy } from '@/content/site';
import { markDayItem } from '@/app/actions/day';
import { markArrival } from '@/app/actions/arrivals';
import { hhmm, humanSpan } from '@/lib/runsheet';
import {
  placeLines, focus, relative, callSheet, dueSoon, isToday, pendingAlert, missing, headcount,
  type Line, type Caller, type Placed,
} from '@/lib/dayof';
import { normalizePhone, displayPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { EVENT_ZONE } from '@/lib/clock';

const c = appCopy.dayOf;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { timeZone: EVENT_ZONE, hour: '2-digit', minute: '2-digit' });

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
  /* Declared after `live` is known, below. */

  useEffect(() => {
    setNow(new Date());
    /* Half a minute. The screen is read, not watched, and a second-by-second
       tick would rerender the whole evening 3,600 times an hour to move a
       label that only changes every sixty. */
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const live = now !== null && isToday(eventDate, now);
  /* The screen stays on while the evening is running, and only then. This is
     the one screen here somebody holds rather than reads: a phone that sleeps
     after thirty seconds has to be woken, unlocked and scrolled back to where
     it was, one-handed, every time they glance at it. */
  const awake = useScreenAwake(live);
  const placed = placeLines(lines, now ?? new Date(0), live);
  const { now: current, next } = focus(placed);
  const sheet = callSheet(crew, vendors);
  const arriving = dueSoon(sheet, now ?? new Date(0), live);
  const late = missing(sheet, now ?? new Date(0), live);
  const heads = headcount(sheet, now ?? new Date(0), live);
  const open = placed.filter((p) => p.state !== 'done').length;

  const alert = pendingAlert(placed);
  /* Dismissed per line rather than globally. Waving away the countdown to the
     chuppah must not also wave away the one to the first dance an hour later. */
  const [hushed, setHushed] = useState<string[]>([]);
  const shouting = alert && !hushed.includes(alert.line.id) ? alert : null;

  return (
    <div className="space-y-5">
      {shouting && (
        <Countdown placed={shouting} onDismiss={() => setHushed((h) => [...h, shouting.line.id])} />
      )}

      {now !== null && !live && (
        <p className="card text-[14px] text-ink-soft">{c.notToday}</p>
      )}

      {/* Said rather than done silently. A screen that refuses to sleep is a
          battery going down, and somebody who has not been told why will
          assume the app is broken rather than that it is helping. */}
      {awake && (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-mute">
          <Sun size={14} strokeWidth={1.5} aria-hidden />
          {c.awake}
        </p>
      )}

      {live && sheet.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[14px] text-ink-soft">
            {c.people.headcount(heads.here, heads.of)}
            {heads.late > 0 && (
              <span className="ms-2 chip-bad">{c.people.missing} · {heads.late}</span>
            )}
          </span>
          <Broadcast sheet={sheet} late={late} />
        </div>
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

      <People sheet={sheet} clientId={clientId} />
    </div>
  );
}

function Headline({ label, placed, fallback, tone }: {
  label: string; placed: Placed | null; fallback: string; tone: 'now' | 'next';
}) {
  return (
    <div className={cn('card', tone === 'now' && 'border-accent bg-accent-wash')}>
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
        'flex items-start gap-3 rounded-xl2 border p-3 transition-colors',
        isNow ? 'border-accent bg-accent-wash'
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
          {done ? <Undo2 size={18} strokeWidth={1.5} aria-hidden /> : <Check size={18} strokeWidth={1.5} aria-hidden />}
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
          {p.line.key_moment && <span className="chip-mute">{c.keyMoment}</span>}
        </div>
        {done && p.line.done_at && (
          <div className="mt-0.5 text-[12.5px] text-ink-mute">{c.doneAt(timeOf(p.line.done_at))}</div>
        )}
      </div>
    </li>
  );
}

function People({ sheet, clientId }: { sheet: Caller[]; clientId: string }) {
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
          const here = !!person.arrived_at;
          return (
            <li
              key={`${person.kind}-${person.id}`}
              className={cn(
                'rounded-xl2 border p-3 transition-colors',
                here ? 'border-ok/30 bg-ok-wash' : 'border-line',
              )}
            >
              <div className="flex items-start gap-3">
                {/* The check-in, first and thumb-sized. Between four and six
                    this is the only control on the screen anybody touches. */}
                <form action={markArrival}>
                  <input type="hidden" name="kind" value={person.kind} />
                  <input type="hidden" name="id" value={person.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="undo" value={here ? '1' : '0'} />
                  <button
                    type="submit"
                    aria-label={here ? c.people.undo : c.people.here}
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-full border transition-colors',
                      here ? 'border-ok bg-ok text-surface' : 'border-line-strong text-ink-mute hover:text-ink',
                    )}
                  >
                    {here ? <Undo2 size={18} strokeWidth={1.5} aria-hidden /> : <UserCheck size={18} strokeWidth={1.5} aria-hidden />}
                  </button>
                </form>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold tabular-nums text-ink">
                      {person.call_time ? hhmm(person.call_time) : c.people.noTime}
                    </span>
                    <span className="text-[15px] text-ink">{person.name}</span>
                    <span className="chip-mute">{person.kind === 'crew' ? c.people.crew : c.people.vendor}</span>
                    {person.role && <span className="text-[13.5px] text-ink-soft">{person.role}</span>}
                    {here && <span className="chip-ok">{c.people.arrived}</span>}
                  </div>

                  {here && person.arrived_at && (
                    <div className="mt-0.5 text-[12.5px] text-ink-mute">
                      {c.people.arrivedAt(timeOf(person.arrived_at))}
                    </div>
                  )}

                  {e164 && (
                    /* Two ways to reach one person, because on the evening one
                       of them is always the wrong one: a supplier mid-set does
                       not pick up, and a driver on the road does not read. */
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={`tel:${e164}`} className="btn-ghost px-4 text-[14px]">
                        <Phone size={16} strokeWidth={1.5} aria-hidden /> {c.people.call}
                        <span className="text-ink-mute tabular-nums">{displayPhone(e164)}</span>
                      </a>
                      <a
                        href={`https://wa.me/${e164.replace('+', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost px-4 text-[14px]"
                      >
                        <MessageCircle size={16} strokeWidth={1.5} aria-hidden /> {c.people.whatsapp}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The ten minute warning.
 *
 * Loud on purpose and dismissible on purpose. A banner that cannot be got rid
 * of is one that gets scrolled past, and a producer who has already handled
 * the chuppah does not need to be told about it for the next nine minutes.
 *
 * Only lines the producer marked as key moments reach here. A run sheet has
 * forty lines and an alert before each one is an alert before none.
 */
function Countdown({ placed, onDismiss }: { placed: Placed; onDismiss: () => void }) {
  const mins = placed.inMinutes ?? 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className="card border-warn/50 bg-warn-wash"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-warn">{c.alert.inMinutes(mins)}</div>
          <div className="mt-0.5 font-display text-[22px] font-semibold leading-tight text-ink">
            {placed.line.title}
          </div>
          <div className="mt-0.5 text-[13.5px] text-ink-soft tabular-nums">{hhmm(placed.line.at_time)}</div>
        </div>
        <button type="button" onClick={onDismiss} className="btn-ghost text-[14px]">
          {c.alert.dismiss}
        </button>
      </div>
    </div>
  );
}

/**
 * One message to everybody who needs it.
 *
 * Not an automated send, and the screen says so. A true broadcast needs a
 * WhatsApp Business number and an approved template, which is a commercial
 * setup rather than a checkbox — and the failure mode of pretending otherwise
 * is the worst available: the producer taps send, believes fifteen suppliers
 * were told, and nobody was.
 *
 * So this composes once and opens the conversation per person, which is what
 * a producer does today by hand with the message retyped fifteen times and a
 * different typo in each.
 */
function Broadcast({ sheet, late }: { sheet: Caller[]; late: Caller[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [who, setWho] = useState<'everyone' | 'here' | 'missing'>('everyone');

  const withPhone = (list: Caller[]) => list.filter((p) => normalizePhone(p.phone));
  const target = withPhone(
    who === 'here' ? sheet.filter((p) => p.arrived_at)
      : who === 'missing' ? late
      : sheet,
  );

  if (withPhone(sheet).length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-[14px] text-bad">
        <Megaphone size={16} strokeWidth={1.5} aria-hidden /> {c.broadcast.open}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label={c.broadcast.cancel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/30 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={c.broadcast.title}
            className="glass-strong relative w-full max-w-lg rounded-t-3xl border border-line p-4 shadow-dock sm:rounded-xl2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] font-semibold text-ink">{c.broadcast.title}</h2>
                <p className="mt-1 text-[13px] text-ink-soft">{c.broadcast.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={c.broadcast.cancel}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-mute hover:text-ink"
              >
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <fieldset className="mt-4">
              <legend className="label">{c.broadcast.to}</legend>
              <div className="flex flex-wrap gap-2">
                {([
                  ['everyone', c.broadcast.everyone],
                  ['missing', c.broadcast.allMissing],
                  ['here', c.broadcast.allHere],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWho(key)}
                    aria-pressed={who === key}
                    className={cn(
                      'min-h-[44px] rounded-xl2 border px-4 text-[13.5px] font-medium transition-colors',
                      who === key ? 'border-ink text-ink' : 'border-line text-ink-soft',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-ink-mute">{c.broadcast.count(target.length)}</p>
            </fieldset>

            <div className="mt-4">
              <label className="label" htmlFor="bc-text">{c.broadcast.title}</label>
              <textarea
                id="bc-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={c.broadcast.placeholder}
                className="field"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {c.broadcast.presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setText(preset)}
                    className="rounded-xl2 border border-line px-3 py-2 text-[12.5px] text-ink-soft hover:border-line-strong"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <ul className="mt-4 max-h-48 list-none space-y-1 overflow-y-auto p-0">
              {target.map((p) => {
                const e164 = normalizePhone(p.phone)!;
                return (
                  <li key={`${p.kind}-${p.id}`}>
                    <a
                      href={`https://wa.me/${e164.replace('+', '')}?text=${encodeURIComponent(text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex min-h-[48px] items-center justify-between gap-3 rounded-xl2 px-3',
                        'text-[15px] transition-colors hover:bg-surface-100',
                        text ? 'text-ink' : 'pointer-events-none text-ink-mute opacity-60',
                      )}
                    >
                      <span>{p.name}</span>
                      <span className="chip-mute">{c.broadcast.send}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
