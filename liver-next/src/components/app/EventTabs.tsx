import Link from 'next/link';
import { serverCopy } from '@/lib/serverLocale';
import { LinkHint } from './LinkHint';
import { TabKeys } from './TabKeys';

/* The list itself lives in content, with no server import behind it, because
   the quick search reads it from the browser and this file now reads the
   request's cookie. Re-exported so the pages keep importing from here. */
import { EVENT_TABS, EVENT_TAB_GROUPS, readTab, type EventTab } from '@/content/eventTabs';
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
 * Sixteen sections is more than a row can hold and more than a list of
 * sixteen can be scanned, so they stand in four groups. Beside the file, from a
 * laptop up, they are a rail with the group names over them and a rose dot on
 * the open one; on a phone the same links are one row that scrolls, cut off at
 * the edge on purpose, in the order the groups give. One set of links drawn by
 * two sets of classes, so the two can never list different sections.
 *
 * A count sits on a tab only where the number changes what somebody does next.
 * A badge on every tab is decoration, and decoration on a number is how a
 * number stops being read.
 */
/* One tone to a group, in the order the groups are drawn, so the four sets of
   links are four colours down the rail and the open one is told from the rest
   by hue as well as by position. Written out in full: Tailwind reads class
   names as text. */
const GROUP_TONE = {
  plan:   { dot: 'bg-tone-rubine',   wash: 'lg:bg-tone-rubine-wash',   ink: 'text-tone-rubine-ink' },
  people: { dot: 'bg-tone-boho',     wash: 'lg:bg-tone-boho-wash',     ink: 'text-tone-boho-ink' },
  money:  { dot: 'bg-tone-tamarind', wash: 'lg:bg-tone-tamarind-wash', ink: 'text-tone-tamarind-ink' },
  talk:   { dot: 'bg-tone-camel',    wash: 'lg:bg-tone-camel-wash',    ink: 'text-tone-camel-ink' },
} as const;

export async function EventTabs({
  clientId, active, counts,
}: {
  clientId: string;
  active: EventTab;
  counts?: Partial<Record<EventTab, number>>;
}) {
  const ui = await serverCopy();
  const labels = ui.clientPage.tabs;
  const groupLabels = ui.clientPage.tabGroups;
  const href = (t: EventTab) => (t === 'overview' ? `/app/clients/${clientId}` : `/app/clients/${clientId}?tab=${t}`);
  /* The order on the screen, which is what the arrow keys walk. */
  const order = EVENT_TAB_GROUPS.flatMap((g) => g.tabs);

  return (
    <nav
      aria-label={ui.clientPage.details}
      /* The bleed, the rule under it and the space below belong to the bar
         this sits inside; one element can either scroll its own contents
         sideways or stick, and on a phone this one has to scroll. From lg it
         stops scrolling and stacks. */
      data-tabstrip
      className="flex flex-nowrap gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-0 lg:overflow-visible"
    >
      {/* Left and right walk the strip, swapped under RTL because in a Hebrew
          row the next tab is to the left. Scoped to focus inside the strip,
          or it would take the arrows off every text field on a screen that is
          mostly forms. */}
      <TabKeys hrefs={order.map(href)} active={order.indexOf(active)} />
      {EVENT_TAB_GROUPS.map((g) => (
        <div key={g.key} className="[display:contents] lg:flex lg:flex-col lg:gap-0.5 lg:[&:not(:first-of-type)]:mt-5">
          <span className="mb-1 hidden items-center gap-2 px-3.5 text-micro text-ink-mute lg:flex">
            <span aria-hidden className={`size-2 rounded-full ${GROUP_TONE[g.key].dot}`} />
            {groupLabels[g.key]}
          </span>
          {g.tabs.map((tab) => {
            const on = tab === active;
            const count = counts?.[tab];
            return (
              <Link
                key={tab}
                href={href(tab)}
                aria-current={on ? 'page' : undefined}
                scroll={false}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 text-body transition lg:min-h-[36px] lg:rounded-control lg:border-b-0 lg:px-3.5 ${
                  on
                    ? `border-accent text-accent ${GROUP_TONE[g.key].wash}`
                    : 'border-transparent text-ink-soft hover:text-ink lg:hover:bg-surface-200'
                }`}
              >
                {on && <span aria-hidden className={`hidden size-1.5 rounded-full lg:block ${GROUP_TONE[g.key].dot}`} />}
                {labels[tab]}
                <LinkHint />
                {count !== undefined && count > 0 && (
                  <span className="rounded-full bg-surface-200 px-1.5 text-micro tabular-nums text-ink-mute lg:bg-card">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
