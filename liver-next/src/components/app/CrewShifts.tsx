'use client';

import Link from 'next/link';
import { CalendarCheck2, ChevronLeft, Clock, MapPin } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { sortShifts, shiftWhen, type Shift } from '@/lib/crewPortal';
import { hhmm } from '@/lib/runsheet';
import { EVENT_ZONE } from '@/lib/clock';
import { Ltr } from '@/components/Ltr';
import type { CrewSlot } from '@/lib/crewNeeds';

/**
 * What a crew member opens the app to see.
 *
 * Not a dashboard. Somebody working three evenings a month wants one answer:
 * where am I next, and when do I get there. So the list is the screen, the
 * soonest evening is at the top, and what is already over sits underneath
 * rather than above — with last night first inside it, because that is the
 * one still being thought about.
 */
export function CrewShifts({ shifts, today }: { shifts: Shift[]; today: string }) {
  const c = useCopy().crew;
  const locale = useCopy().locale;
  const labels: Record<CrewSlot, string> = {
    manager: c.slotManager, assistant: c.slotAssistant, social: c.slotSocial,
  };
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (shifts.length === 0) {
    return (
      <div className="card p-6 text-center">
        <CalendarCheck2 size={22} strokeWidth={1.5} aria-hidden className="mx-auto text-ink-mute" />
        <p className="mt-3 text-[15px] text-ink">{c.shiftsNone}</p>
        <p className="mt-1 text-[13.5px] text-ink-mute">{c.shiftsNoneHint}</p>
      </div>
    );
  }

  return (
    <ul className="list-none space-y-3.5 p-0">
      {sortShifts(shifts, today).map((s) => {
        const when = shiftWhen(s.event_date, today);
        const slot = s.slot && s.slot in labels ? labels[s.slot as CrewSlot] : s.role;
        return (
          <li
            key={s.client_id}
            className={`card relative p-4 transition-colors focus-within:border-accent hover:border-accent sm:p-5 ${
              when === 'past' ? 'opacity-70' : ''
            }`}
          >
            <Link
              href={`/app/shifts/${s.client_id}`}
              className="absolute inset-0 z-0 rounded-[inherit]"
              aria-label={`${c.shiftOpen}: ${s.display_name}`}
            >
              <span className="sr-only">{s.display_name}</span>
            </Link>

            <div className="pointer-events-none relative flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-[18px] font-semibold text-ink">{s.display_name}</h3>
                  {when === 'today' && (
                    <span className="rounded-xl2 bg-accent-wash px-2 py-0.5 text-[12.5px] text-accent">
                      {c.shiftToday}
                    </span>
                  )}
                  {when === 'past' && (
                    <span className="text-[12.5px] text-ink-mute">{c.shiftPast}</span>
                  )}
                </div>

                <p className="mt-1 text-[14px] text-ink-soft">
                  {s.event_date ? fmt.format(new Date(s.event_date)) : c.shiftNoDate}
                </p>

                <dl className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-soft">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MapPin size={14} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
                    <dd className="truncate">{s.venue || c.shiftNoVenue}</dd>
                  </div>
                  {s.call_time && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
                      <dd><Ltr>{hhmm(s.call_time)}</Ltr></dd>
                    </div>
                  )}
                  {slot && (
                    <div className="flex items-center gap-1.5">
                      <dt className="text-ink-mute">{c.shiftMyRole}</dt>
                      <dd>{slot}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <ChevronLeft size={18} aria-hidden strokeWidth={1.5} className="chev-onward mt-1 shrink-0 text-ink-mute" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
