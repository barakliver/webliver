import { CalendarDays } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { shortDate } from '@/lib/appDates';
import type { AppUi } from '@/content/appUi';

/** A meeting as the couple sees it: what it was called, when, and what was
 *  agreed. The questionnaire behind a templated meeting stays with the
 *  producer; what crosses to the couple is the summary, which is the record
 *  the version trigger keeps and the thing a supplier is paid against. */
export type SharedMeeting = {
  id: string;
  client_id: string;
  kind: string;
  title: string;
  held_on: string | null;
  summary: string;
};

/**
 * The meetings the producer shared, on the couple's screen.
 *
 * The switch on every meeting form promised this since the day it was
 * built, and until now nothing on this screen read the table it wrote to.
 * A producer ticked "משותף עם הזוג" and believed the couple could see what
 * was agreed; the couple saw nothing; neither side could tell. This is the
 * other half of that switch.
 *
 * Read-only on purpose. A meeting log is the producer's record of what was
 * said and agreed, and a couple editing one after the fact is not a
 * correction, it is a different document. What they can do with it is read
 * it, and raise anything in the thread below.
 */
export function PortalMeetings({ meetings, ui }: { meetings: SharedMeeting[]; ui: AppUi }) {
  const c = ui.portal.meetings;
  const dateFmt = shortDate(ui.locale);

  return (
    <section className="card">
      <h2 className="font-display text-[22px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-mute">{c.sub}</p>

      {meetings.length === 0 ? (
        <p className="mt-5 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {meetings.map((m) => (
            <li key={m.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[15.5px] font-medium text-ink">{m.title || c.untitled}</h3>
                {m.held_on && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
                    <CalendarDays size={13} aria-hidden strokeWidth={1.5} />
                    {formatDate(dateFmt, m.held_on, '')}
                  </span>
                )}
              </div>
              {m.summary ? (
                <p className="mt-2 max-w-prose2 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">{m.summary}</p>
              ) : (
                <p className="mt-2 text-[13.5px] text-ink-mute">{c.noSummary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
