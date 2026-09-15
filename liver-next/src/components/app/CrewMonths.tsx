'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Check, ChevronDown, Clock, TriangleAlert } from 'lucide-react';
import { setCrewHours, setCrewFee, type CrewMemberResult } from '@/app/actions/crewMembers';
import { useCopy } from '@/components/app/CopyProvider';
import { Ltr, Money } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';

export type MonthEvening = {
  /** The `crew` row, which is what the hours are written on. */
  crewId: string;
  clientId: string;
  clientName: string;
  date: string;
  fee: number;
  hours: number | null;
  hourRate: number | null;
  pay: number;
};

export type MonthPersonRow = {
  memberId: string;
  name: string;
  evenings: MonthEvening[];
  total: number;
};

export type MonthRow = {
  month: string;
  people: MonthPersonRow[];
  total: number;
};

function Save() {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost shrink-0 text-[13px]" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

/**
 * The hours, on the evening they were worked.
 *
 * Deliberately here rather than on the event screen: this is the list somebody
 * works down at the start of the month with a bank app open, and making them
 * open nine event files to record nine overruns is what keeps the overruns in
 * a WhatsApp thread.
 */
/**
 * The agreed fee, where the total that uses it is read.
 *
 * Separate form from the hours, because they answer different questions and
 * are corrected at different times: the fee is what was agreed, the hours are
 * what happened. Its own row so an evening with nothing agreed says so
 * loudly — a zero in a payment list is the one number nobody notices.
 */
function Fee({ e }: { e: MonthEvening }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(setCrewFee, null);
  return (
    <form action={action} className="mt-1.5 flex flex-wrap items-end gap-2">
      <input type="hidden" name="crew_id" value={e.crewId} />
      <input type="hidden" name="client_id" value={e.clientId} />
      <div>
        <label className="label text-[11.5px]" htmlFor={`f-${e.crewId}`}>{c.fee}</label>
        <input
          id={`f-${e.crewId}`} name="fee" type="number" min="0" step="50"
          defaultValue={e.fee ? String(e.fee) : ''}
          className="field w-28 text-[13px]" inputMode="numeric"
        />
      </div>
      <Save />
      {state?.ok && (
        <span className="inline-flex items-center gap-1 pb-2 text-[12.5px] text-good">
          <Check size={13} aria-hidden strokeWidth={1.5} />{c.crewNoteSaved}
        </span>
      )}
      {state?.error && <span className="pb-2 text-[12.5px] text-bad">{state.error}</span>}
    </form>
  );
}

function Hours({ e }: { e: MonthEvening }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(setCrewHours, null);
  /* Behind a row, because most evenings have no extra hours and two number
     fields under every one of them turns a payment list into a form. Open
     already when there are hours: then it is the thing being read. */
  return (
    <details open={!!e.hours} className="group/h mt-1">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[12.5px]
                   text-ink-mute transition-colors hover:text-accent
                   [&::-webkit-details-marker]:hidden"
      >
        <Clock size={12} aria-hidden strokeWidth={1.5} />
        {c.hoursAdd}
        <ChevronDown
          size={12} aria-hidden strokeWidth={1.5}
          className="transition-transform duration-200 group-open/h:rotate-180"
        />
      </summary>
      <form action={action} className="mt-1.5 flex flex-wrap items-end gap-2">
      <input type="hidden" name="crew_id" value={e.crewId} />
      <input type="hidden" name="client_id" value={e.clientId} />
      <div>
        <label className="label text-[11.5px]" htmlFor={`h-${e.crewId}`}>{c.hoursExtra}</label>
        <input
          id={`h-${e.crewId}`} name="extra_hours" type="number" min="0" max="24" step="0.5"
          defaultValue={e.hours === null ? '' : String(e.hours)}
          className="field w-24 text-[13px]" inputMode="decimal"
        />
      </div>
      <div>
        <label className="label text-[11.5px]" htmlFor={`hr-${e.crewId}`}>{c.hoursRate}</label>
        <input
          id={`hr-${e.crewId}`} name="hour_rate" type="number" min="0" step="10"
          defaultValue={e.hourRate === null ? '' : String(e.hourRate)}
          className="field w-24 text-[13px]" inputMode="numeric"
        />
      </div>
      <Save />
      {state?.ok && (
        <span className="inline-flex items-center gap-1 pb-2 text-[12.5px] text-good">
          <Check size={13} aria-hidden strokeWidth={1.5} />{c.crewNoteSaved}
        </span>
      )}
      {state?.error && <span className="pb-2 text-[12.5px] text-bad">{state.error}</span>}
      </form>
    </details>
  );
}

/**
 * What to pay, month by month.
 *
 * The question at the start of every month is one question — what do I owe
 * each of these people for last month — and until now the answer was a column
 * on one table that nothing summed and a fee per evening spread across nine
 * event files.
 *
 * So it is grouped the way the paying happens: the month, then the person,
 * then the evenings behind their figure. The evenings are there so a number
 * that looks wrong can be argued with rather than only doubted, and so the
 * hours can be added where they were worked.
 *
 * The newest month is open and the rest are closed: the month being paid is
 * almost always the one that just ended.
 */
export function CrewMonths({ months }: { months: MonthRow[] }) {
  const c = useCopy().crew;
  const locale = useCopy().locale;

  const monthFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, month: 'long', year: 'numeric',
  });
  const dayFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, day: 'numeric', month: 'short',
  });

  if (months.length === 0) {
    return <p className="text-[14px] text-ink-mute">{c.monthsNone}</p>;
  }

  return (
    <div className="space-y-4">
      {months.map((m, i) => (
        <details key={m.month} open={i === 0} className="group/m card p-0">
          <summary
            className="flex cursor-pointer list-none items-baseline justify-between gap-4 p-4 sm:p-5
                       [&::-webkit-details-marker]:hidden"
          >
            <span className="flex items-baseline gap-3">
              <span className="font-display text-[17px] font-semibold text-ink">
                {monthFmt.format(new Date(`${m.month}-01T12:00:00Z`))}
              </span>
              <ChevronDown
                size={17} strokeWidth={1.5} aria-hidden
                className="shrink-0 self-center text-ink-mute transition-transform duration-200 group-open/m:rotate-180"
              />
            </span>
            <span className="flex items-baseline gap-2 text-[14px]">
              <span className="text-ink-mute">{c.monthsTotal}</span>
              <b className="font-semibold text-ink"><Money value={m.total} /></b>
            </span>
          </summary>

          <ul className="list-none space-y-3 border-t border-line-soft p-4 sm:p-5">
            {m.people.map((p) => (
              <li key={p.memberId} className="rounded-xl2 border border-line-soft bg-surface-100 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-[15px] text-ink">{p.name}</span>
                  <span className="flex items-baseline gap-2 text-[14px]">
                    <span className="text-ink-mute">{c.monthsPay}</span>
                    <b className="font-semibold text-ink"><Money value={p.total} /></b>
                  </span>
                </div>

                <ul className="mt-2 list-none space-y-2.5 p-0">
                  {p.evenings.map((e) => (
                    <li key={e.crewId} className="border-t border-line-soft pt-2 first:border-0 first:pt-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13.5px]">
                        <Link
                          href={`/app/clients/${e.clientId}`}
                          className="text-ink transition-colors hover:text-accent"
                        >
                          {e.clientName}
                        </Link>
                        <span className="flex items-baseline gap-3 text-ink-mute">
                          <span>{dayFmt.format(new Date(e.date))}</span>
                          {!!e.hours && (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} aria-hidden strokeWidth={1.5} />
                              <Ltr>{String(e.hours)}</Ltr>
                            </span>
                          )}
                          <span className="text-ink"><Money value={e.pay} /></span>
                        </span>
                      </div>
                      {/* An evening with nothing agreed is the reason a month
                          adds up to less than it should, so it says so rather
                          than contributing a quiet zero. */}
                      {!e.fee && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-warn">
                          <TriangleAlert size={12} aria-hidden strokeWidth={1.5} />
                          {c.feeMissing}
                        </p>
                      )}
                      <Fee e={e} />
                      <Hours e={e} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
