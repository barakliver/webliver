'use client';

import Link from 'next/link';
import { ChevronRight, Clock, MapPin, Package, Users } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import type { ShiftDetail } from '@/lib/crewPortal';
import { hhmm } from '@/lib/runsheet';
import { EVENT_ZONE } from '@/lib/clock';
import { Ltr } from '@/components/Ltr';
import type { CrewSlot } from '@/lib/crewNeeds';

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
        {icon}{title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * One evening, for the person working it.
 *
 * The order is the order of the questions somebody actually asks, in the car:
 * when and where, what am I doing, what did the producer want me to know, the
 * run sheet, the kit, and who else is on it. Money is not on this screen and
 * cannot be: the function behind it does not return it (0091).
 */
export function CrewShift({ detail, today }: { detail: ShiftDetail; today: string }) {
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

  return (
    <div className="space-y-4">
      <Link
        href="/app/shifts"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft transition-colors hover:text-ink"
      >
        <ChevronRight size={15} aria-hidden strokeWidth={1.5} className="chev-back" />
        {c.shiftBack}
      </Link>

      <header>
        <h2 className="font-display text-[24px] font-semibold text-ink">{event.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-ink-soft">
          <span>{event.date ? fmt.format(new Date(event.date)) : c.shiftNoDate}</span>
          {isToday && (
            <span className="rounded-xl2 bg-accent-wash px-2 py-0.5 text-[12.5px] text-accent">
              {c.shiftToday}
            </span>
          )}
        </p>
      </header>

      {/* The two facts somebody needs before they leave the house. */}
      <section className="card grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="eyebrow">{c.shiftWhere}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[15px] text-ink">
            <MapPin size={15} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
            {event.venue || c.shiftNoVenue}
          </p>
        </div>
        <div>
          <p className="eyebrow">{c.shiftMyCall}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[15px] text-ink">
            <Clock size={15} className="text-ink-mute" aria-hidden strokeWidth={1.5} />
            {mine.callTime ? <Ltr>{hhmm(mine.callTime)}</Ltr> : c.noTime}
          </p>
        </div>
        <div>
          <p className="eyebrow">{c.shiftMyRole}</p>
          <p className="mt-1 text-[15px] text-ink">{nameOf(mine.slot, mine.role) || c.slotNone}</p>
        </div>
      </section>

      {mine.note && (
        <Card title={c.shiftMyNote} icon={<></>}>
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{mine.note}</p>
        </Card>
      )}

      <Card title={c.shiftNotes} icon={<></>}>
        {event.crewNote ? (
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{event.crewNote}</p>
        ) : (
          <p className="text-[14px] text-ink-mute">{c.shiftNoNotes}</p>
        )}
      </Card>

      <Card title={c.shiftSchedule} icon={<Clock size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />}>
        {schedule.length === 0 ? (
          <p className="text-[14px] text-ink-mute">{c.shiftNoSchedule}</p>
        ) : (
          <ol className="list-none space-y-2 p-0">
            {schedule.map((r) => (
              <li key={r.id} className="flex gap-3 border-b border-line-soft pb-2 last:border-0 last:pb-0">
                <span className="w-14 shrink-0 tabular-nums text-[14px] text-ink-soft">
                  <Ltr>{hhmm(r.at)}</Ltr>
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] text-ink">{r.title}</span>
                  {r.note && <span className="mt-0.5 block text-[13px] text-ink-mute">{r.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title={c.shiftKit} icon={<Package size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />}>
        {kit.length === 0 ? (
          <p className="text-[14px] text-ink-mute">{c.shiftNoKit}</p>
        ) : (
          <ul className="list-none space-y-2 p-0">
            {kit.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[14.5px] text-ink">{k.item}</span>
                {k.needed && !k.sorted && (
                  <span className="rounded-xl2 bg-warn-wash px-2 py-0.5 text-[12.5px] text-warn">
                    {c.shiftKitNeeded}
                  </span>
                )}
                {k.sorted && (
                  <span className="rounded-xl2 bg-good-wash px-2 py-0.5 text-[12.5px] text-good">
                    {c.shiftKitSorted}
                  </span>
                )}
                {k.note && <span className="text-[13px] text-ink-mute">{k.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={c.shiftWho} icon={<Users size={17} className="text-ink-mute" aria-hidden strokeWidth={1.5} />}>
        {crew.length <= 1 ? (
          <p className="text-[14px] text-ink-mute">{c.shiftAlone}</p>
        ) : (
          <ul className="list-none space-y-1.5 p-0">
            {crew.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex flex-wrap items-baseline gap-x-3 text-[14.5px]">
                <span className="text-ink">{p.name}</span>
                <span className="text-[13px] text-ink-mute">{nameOf(p.slot, p.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
