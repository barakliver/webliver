'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { BellRing, ChevronRight, Clock, MapPin, Package, Plus, Users } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import type { ShiftDetail } from '@/lib/crewPortal';
import { hhmm } from '@/lib/runsheet';
import { EVENT_ZONE } from '@/lib/clock';
import { Ltr } from '@/components/Ltr';
import type { CrewSlot } from '@/lib/crewNeeds';
import { cn } from '@/lib/utils';

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 head-sub">
        {icon}{title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}


/** A note of one's own on a line of the evening, kept on this phone.
 *
 *  A crew member has nowhere to write to and that is on purpose (0091: they
 *  read through two functions and no policy was widened for them), so this is
 *  a reminder rather than a message: it never leaves the device, and the
 *  screen says so. Storage can be refused, and then the note lives until the
 *  screen is left rather than breaking anything. */
function LineNote({ eventId, lineId }: { eventId: string; lineId: string }) {
  const c = useCopy().crew;
  const key = `shift-note:${eventId}:${lineId}`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { const v = window.localStorage.getItem(key); if (v) setText(v); } catch { /* the note starts empty */ }
  }, [key]);
  const save = (v: string) => {
    setText(v);
    try { if (v.trim()) window.localStorage.setItem(key, v); else window.localStorage.removeItem(key); } catch { /* kept until the screen is left */ }
  };
  if (open) {
    return (
      <span className="mt-1 block">
        <input autoFocus value={text} onChange={(e) => save(e.target.value)} onBlur={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setOpen(false); }}
          placeholder={c.shiftLineNotePh} aria-label={c.shiftLineNotePh} autoComplete="off" enterKeyHint="done"
          className="field min-h-[40px] py-1.5 text-body" />
        <span className="mt-0.5 block text-micro text-ink-mute">{c.shiftLineNoteHint}</span>
      </span>
    );
  }
  return text ? (
    <button type="button" onClick={() => setOpen(true)} className="mt-0.5 block text-start text-body text-accent">{text}</button>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-0.5 inline-flex min-h-[32px] items-center gap-1 text-meta text-ink-mute hover:text-ink">
      <Plus size={13} aria-hidden strokeWidth={1.5} />{c.shiftLineNoteAdd}
    </button>
  );
}

/** The ring before the call time. Four lengths, one press: the calendar on the
 *  phone does the ringing, so it works with the screen off. */
function Alarm({ eventId }: { eventId: string }) {
  const c = useCopy().crew;
  const [mins, setMins] = useState<30 | 60 | 90 | 120>(90);
  const opts = c.shiftAlarmOpts as Record<number, string>;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-meta text-ink-mute"><BellRing size={13} aria-hidden strokeWidth={1.5} />{c.shiftAlarmTitle}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="alarm-mins">{c.shiftAlarmBefore}</label>
        <select id="alarm-mins" value={mins} onChange={(e) => setMins(Number(e.target.value) as 30 | 60 | 90 | 120)} className="field w-auto py-1.5 text-body">
          {([30, 60, 90, 120] as const).map((m) => <option key={m} value={m}>{opts[m]}</option>)}
        </select>
        <a href={`/app/shifts/${eventId}/alarm.ics?m=${mins}`} className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap">
          <BellRing size={15} aria-hidden strokeWidth={1.5} />{c.shiftAlarmAdd}
        </a>
      </div>
      <p className="mt-1.5 text-micro text-ink-mute">{c.shiftAlarmHint}</p>
    </div>
  );
}

/** Whole days from today to a date, for the numeral beside the name. Null
 *  when there is no date or the evening is over. */
function daysUntil(date: string | null, today: string): number | null {
  if (!date) return null;
  const d = Math.round((Date.parse(`${date.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return d > 0 ? d : null;
}

/**
 * One evening, for the person working it.
 *
 * The order is the order of the questions somebody actually asks, in the car:
 * when and where, what am I doing, what did the producer want me to know, the
 * run sheet, the kit, and who else is on it. Money is not on this screen and
 * cannot be: the function behind it does not return it (0091).
 */
export function CrewShift({ detail, today, rail }: { detail: ShiftDetail; today: string; rail?: ReactNode }) {
  const c = useCopy().crew;
  const locale = useCopy().locale;
  const labels: Record<CrewSlot, string> = {
    manager: c.slotManager, assistant: c.slotAssistant, social: c.slotSocial,
  };
  const nameOf = (slot: string | null, role: string) =>
    slot && slot in labels ? labels[slot as CrewSlot] : role;

  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const { event, mine, schedule, kit, crew } = detail;
  const isToday = !!event.date && event.date.slice(0, 10) === today;
  const left = daysUntil(event.date, today);

  return (
    <div className={rail ? 'lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-10' : undefined}>
      {rail && <aside className="hidden lg:block">{rail}</aside>}
    <div className="space-y-4">
      <Link
        href="/app/shifts"
        className="inline-flex items-center gap-1.5 text-body text-ink-soft transition-colors hover:text-ink"
      >
        <ChevronRight size={15} aria-hidden strokeWidth={1.5} className="chev-back" />
        {c.shiftBack}
      </Link>

      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-panel font-light text-ink sm:text-[34px]">{event.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-ink-soft">
            <span>{event.date ? fmt.format(new Date(event.date)) : c.shiftNoDate}</span>
            {isToday && (
              <span className="rounded-full bg-accent-wash px-2.5 py-0.5 text-meta text-accent">
                {c.shiftToday}
              </span>
            )}
          </p>
        </div>
        {left !== null && (
          <div className="shrink-0 text-center leading-none">
            <p className="font-display text-[38px] font-light tabular-nums text-accent-bright sm:text-[44px]">{left}</p>
            <p className="mt-1 text-micro text-ink-mute">{c.shiftDaysLeft}</p>
          </div>
        )}
      </header>

      {/* The two facts somebody needs before they leave the house. */}
      <section className="card grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="eyebrow">{c.shiftWhere}</p>
          <p className="mt-1 flex items-center gap-1.5 text-lead text-ink">
            <MapPin size={15} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
            {event.venue || c.shiftNoVenue}
          </p>
        </div>
        <div>
          <p className="eyebrow">{c.shiftMyCall}</p>
          <p className="mt-1 flex items-center gap-1.5 text-lead text-ink">
            <Clock size={15} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
            {mine.callTime ? <Ltr>{hhmm(mine.callTime)}</Ltr> : c.noTime}
          </p>
        </div>
        <div>
          <p className="eyebrow">{c.shiftMyRole}</p>
          <p className="mt-1 text-lead text-ink">{nameOf(mine.slot, mine.role) || c.slotNone}</p>
        </div>
      </section>

      {/* Under the facts it belongs to rather than in a card of its own: the
          ring is about the time above it. Nothing to ring for without one. */}
      {mine.callTime && (
        <section className="card p-4 sm:p-5">
          <Alarm eventId={event.id} />
        </section>
      )}

      {mine.note && (
        <Card title={c.shiftMyNote} icon={<></>}>
          <p className="whitespace-pre-line text-body leading-relaxed text-ink">{mine.note}</p>
        </Card>
      )}

      <Card title={c.shiftNotes} icon={<></>}>
        {event.crewNote ? (
          <p className="whitespace-pre-line text-body leading-relaxed text-ink">{event.crewNote}</p>
        ) : (
          <p className="text-body text-ink-mute">{c.shiftNoNotes}</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card title={c.shiftSchedule} icon={<Clock size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />}>
        {schedule.length === 0 ? (
          <p className="text-body text-ink-mute">{c.shiftNoSchedule}</p>
        ) : (
          <ol className="list-none space-y-2 p-0">
            {schedule.map((r) => (
              <li key={r.id} className="flex gap-3 border-b border-line-soft pb-2 last:border-0 last:pb-0">
                <span className="w-14 shrink-0 font-display text-lead font-light tabular-nums text-accent-bright">
                  <Ltr>{hhmm(r.at)}</Ltr>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lead text-ink">{r.title}</span>
                  {r.note && <span className="mt-0.5 block text-body text-ink-mute">{r.note}</span>}
                  <LineNote eventId={event.id} lineId={r.id} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

        <div className="space-y-4">
      <Card title={c.shiftKit} icon={<Package size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />}>
        {kit.length === 0 ? (
          <p className="text-body text-ink-mute">{c.shiftNoKit}</p>
        ) : (
          <ul className="list-none space-y-2 p-0">
            {kit.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-body text-ink">{k.item}</span>
                {k.needed && !k.sorted && (
                  <span className="rounded-xl2 bg-warn-wash px-2 py-0.5 text-meta text-warn">
                    {c.shiftKitNeeded}
                  </span>
                )}
                {k.sorted && (
                  <span className="rounded-xl2 bg-good-wash px-2 py-0.5 text-meta text-good">
                    {c.shiftKitSorted}
                  </span>
                )}
                {k.note && <span className="text-body text-ink-mute">{k.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={c.shiftWho} icon={<Users size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />}>
        {crew.length <= 1 ? (
          <p className="text-body text-ink-mute">{c.shiftAlone}</p>
        ) : (
          <ul className="list-none space-y-1.5 p-0">
            {crew.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex flex-wrap items-baseline gap-x-3 text-body">
                <span className="text-ink">{p.name}</span>
                <span className="text-body text-ink-mute">{nameOf(p.slot, p.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
