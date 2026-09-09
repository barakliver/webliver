import Link from 'next/link';
import { serverCopy } from '@/lib/serverLocale';
import { LinkHint } from './LinkHint';

/* The list itself lives in content, with no server import behind it, because
   the quick search reads it from the browser and this file now reads the
   request's cookie. Re-exported so the pages keep importing from here. */
import { EVENT_TABS, readTab, type EventTab } from '@/content/eventTabs';
export { EVENT_TABS, readTab, type EventTab };

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
export async function EventTabs({
  clientId, active, counts,
}: {
  clientId: string;
  active: EventTab;
  counts?: Partial<Record<EventTab, number>>;
}) {
  const ui = await serverCopy();
  const labels = ui.clientPage.tabs;

  return (
    <nav
      aria-label={ui.clientPage.details}
      /* One row that scrolls, rather than nine pills wrapping onto three. Three
         rows of chrome above the content is most of a phone screen spent on
         navigation, and the section somebody came for starts below the fold on
         every single visit. `-mx-5` lets the strip run to both edges of the
         shell so the last tab is visibly cut off, which is what tells a thumb
         there is more to the right. */
      className="-mx-5 mb-6 flex gap-1.5 overflow-x-auto border-b border-line px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0"
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
            className={`inline-flex min-h-[44px] sm:min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl2 px-4 text-[14px] transition ${
              on
                ? 'bg-ink font-medium text-surface'
                : 'text-ink-soft hover:bg-surface-200 hover:text-ink'
            }`}
          >
            {labels[tab]}
            <LinkHint />
            {count !== undefined && count > 0 && (
              <span className={`rounded-xl2 px-1.5 text-[11.5px] tabular-nums ${
                on ? 'bg-card/20 text-surface' : 'bg-surface-200 text-ink-mute'
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
