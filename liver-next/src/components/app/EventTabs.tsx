import Link from 'next/link';
import { appCopy } from '@/content/site';

/** The sections of an event file, in the order somebody works through one. */
export const EVENT_TABS = ['overview', 'tasks', 'day', 'guests', 'money', 'docs', 'messages', 'board'] as const;
export type EventTab = (typeof EVENT_TABS)[number];

export const readTab = (raw: string | undefined): EventTab =>
  (EVENT_TABS as readonly string[]).includes(raw ?? '') ? (raw as EventTab) : 'overview';

/**
 * Sections rather than a scroll.
 *
 * Nine panels stacked on one page is not a file: whatever somebody came for is
 * below the fold, and the page pays to load all nine every time to show the
 * one. These are links rather than client state, so each section is a real
 * address that can be sent to somebody, opened in a second tab, and reloaded
 * without losing your place — and so the page can fetch only the section it is
 * about to draw.
 *
 * A count sits on a tab only where the number changes what somebody does next.
 * A badge on every tab is decoration, and decoration on a number is how a
 * number stops being read.
 */
export function EventTabs({
  clientId, active, counts,
}: {
  clientId: string;
  active: EventTab;
  counts?: Partial<Record<EventTab, number>>;
}) {
  const labels = appCopy.clientPage.tabs;

  return (
    <nav
      aria-label={appCopy.clientPage.details}
      className="-mx-1 mb-6 flex flex-wrap gap-1.5 border-b border-line pb-3"
    >
      {EVENT_TABS.map((tab) => {
        const on = tab === active;
        const count = counts?.[tab];
        return (
          <Link
            key={tab}
            href={tab === 'overview' ? `/app/clients/${clientId}` : `/app/clients/${clientId}?tab=${tab}`}
            aria-current={on ? 'page' : undefined}
            scroll={false}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-[14px] transition ${
              on
                ? 'bg-ink font-medium text-white'
                : 'text-ink-soft hover:bg-ivory-200 hover:text-ink'
            }`}
          >
            {labels[tab]}
            {count !== undefined && count > 0 && (
              <span className={`rounded-full px-1.5 text-[11.5px] tabular-nums ${
                on ? 'bg-white/20 text-white' : 'bg-ivory-200 text-ink-mute'
              }`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
