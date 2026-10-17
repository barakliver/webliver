import { Pencil } from 'lucide-react';
import { serverCopy } from '@/lib/serverLocale';
import type { ClientStatus } from '@/lib/status';
import { formatDate } from '@/lib/dates';
import { Ltr, Name } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';
import { Countdown, GapChip } from '@/components/app/StatusBoard';

/**
 * The top of an event's file: the same ring, the same pill and the same gap
 * chips the card for this event wears on the list, so the card and the file it
 * opens are visibly one thing.
 *
 * Drawn from the status reading, which is the list's own function asked about
 * one event. A second reading of "what is missing" written for this screen
 * would be a second answer, and the chips on the card and the chips here would
 * disagree the first week somebody fixed one of them.
 *
 * The tag and the kind of engagement arrive as children rather than being
 * drawn here, because they are controls with a server action behind each and
 * this is a heading.
 */
export async function EventHead({ s, renameHref, children }: {
  s: ClientStatus;
  renameHref: string;
  children?: React.ReactNode;
}) {
  const ui = await serverCopy();
  const c = ui.statusBoard;
  const fmt = new Intl.DateTimeFormat(ui.locale === 'en' ? 'en-GB' : 'he-IL', { timeZone: EVENT_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <header className="card mb-6 p-5 sm:p-6">
      <div className="flex items-center gap-4 sm:gap-6">
        <Countdown days={s.daysLeft} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate font-display text-title font-light text-ink">{s.name}</h1>
            {/* A pencil on the name itself. A typo in a couple's name is seen
                at the top of the screen, so the way to fix it belongs there.
                A plain anchor, not the router's link: from the overview the
                router saw the same path and did nothing with the hash. */}
            <a
              href={renameHref}
              aria-label={ui.clientPage.rename}
              title={ui.clientPage.rename}
              className="grid size-9 shrink-0 place-items-center rounded-control text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.5} aria-hidden />
            </a>
          </div>
          <p className="mt-1 text-lead text-ink-soft">
            {formatDate(fmt, s.eventDate, c.noDate)}
            {s.venue ? <> · <Name>{s.venue}</Name></> : ''}
            {s.guestEstimate ? <> · <Ltr>{s.guestEstimate.toLocaleString('en-US')}</Ltr></> : ''}
          </p>
          {s.gaps.length > 0 && (
            <ul className="mt-3 flex list-none flex-wrap gap-1.5 p-0">
              {s.gaps.map((g) => (
                <li key={g.code}><GapChip label={g.label} level={g.level} /></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {children && <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">{children}</div>}
    </header>
  );
}
