import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Ltr, Money, Ratio } from '@/components/Ltr';
import type { PortalCopy } from '@/content/appUi';

/**
 * The four numbers a couple opens the app for.
 *
 * Six widgets became four rows. A grid of tiles is a screen somebody scans;
 * four rules with a figure on each is a screen somebody reads, and on a phone
 * held one-handed at a supplier meeting the second one wins.
 *
 * Every value is a real count from the workspace, so a row that says nothing
 * yet says zero rather than hiding: a couple who has not started their guest
 * list needs to see that the list exists, and an absent row teaches them it
 * does not.
 *
 * Each row links down to its own panel rather than to another page. The panels
 * are already on this screen; the rows are a way in, not a second copy.
 */
export type SummaryRow = {
  key: string;
  label: string;
  value: React.ReactNode;
  href: string;
  /** Hidden when the module is closed for this couple. A locked row
   *  advertising something they were not sold is a sales screen wearing the
   *  clothes of a tool. */
  shown: boolean;
  /** Whether this row carries a number worth reading on arrival.
   *
   *  This list grew from four rows to seventeen, one per section, and in
   *  doing so it stopped being a summary and became a second table of
   *  contents — printed in full, above the fold, on a screen that already
   *  had one. Thirteen of the seventeen had no figure on them at all: they
   *  were links wearing the shape of a statistic.
   *
   *  The way around lives in the dock now. What is left here is what the
   *  file was named for: the few numbers a couple opens the app to see.
   *  Nothing is lost — every section is one tap away in the dock and every
   *  panel is still on the page. */
  figure?: boolean;
};

export function PortalSummary({ rows, label }: { rows: SummaryRow[]; label: string }) {
  const live = rows.filter((r) => r.shown && r.figure);
  if (live.length === 0) return null;

  return (
    <nav aria-label={label} className="mt-8">
      {/* One object rather than four.
          These were four full-width rules with a figure on each, which is a
          list, and a list of four is four things to look at. Inside a single
          rounded surface they are one thing with four lines in it, which is
          what the rest of this screen is being counted down to.

          The separator starts where the label starts instead of at the edge,
          which is the detail that makes a list read as drawn rather than as
          stacked; it is done with a border on the row inside the padding,
          so it inherits the row's inset for free and never doubles at the
          top. */}
      <ul className="list-none overflow-hidden rounded-card bg-surface-100 p-0">
        {live.map((r, i) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className={`mx-4 flex min-h-[52px] items-center justify-between gap-4
                          transition-colors duration-300 hover:text-accent
                          ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="text-[15.5px]">{r.label}</span>
              <span className="flex items-center gap-2.5">
                {/* Some sections have a number worth showing beside the name
                    and some do not: the thread has no count that means
                    anything, and a made-up one is worse than the arrow alone. */}
                {r.value !== null && (
                  <span className="text-[17px] font-semibold tabular-nums">{r.value}</span>
                )}
                {/* Points the way the language runs. In a right-to-left page
                    a chevron aimed right is aimed backwards. */}
                <ChevronLeft size={15} strokeWidth={1.5} className="chev-onward text-ink-mute" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Builds the four rows from the workspace's own data. Kept beside the
 *  component so the labels and the figures cannot drift apart. */
export function summaryRows(opts: {
  budget: number | null;
  /* What is still owed, which is the payments figure a couple actually
     wants: the total paid is history, the balance is a decision. */
  owed: number;
  openTasks: number;
  attending: number; invited: number;
  tables: number;
  contracts: number; venues: number; files: number;
  saved: number; vendors: number; meetings: number;
  envelopes: number; vehicles: number;
  can: (key: string) => boolean;
  /* Resolved by the caller. This runs on the server for a couple who may be
     reading English. */
  c: PortalCopy;
}): SummaryRow[] {
  const c = opts.c;
  /* Every section on the couple's screen, in the order it appears below, so
     the strip reads as a table of contents and not as four favourites. A row
     whose module is switched off for this plan is left out rather than shown
     locked; a row with nothing to count carries no figure. */
  return [
    { key: 'tasks',     label: c.rowTasks,     value: <Ltr>{opts.openTasks}</Ltr>, href: '#tasks',     shown: opts.can('tasks'), figure: true },
    {
      key: 'budget',
      /* Nothing entered is not zero. A couple who has not broken their budget
         into lines was being shown a budget of nought, which reads as a fact
         about their wedding rather than as a fact about the screen. */
      label: c.rowBudget,
      /* Nought rather than a dot when nothing is entered: the dot read as a
         broken figure on the summary, and the row's own link leads to where
         the budget is set. */
      value: <Money value={opts.budget ?? 0} className={opts.budget === null ? 'text-ink-mute' : undefined} />,
      href: '#budget',
      figure: true,
      shown: opts.can('budget'),
    },
    { key: 'payments',  label: c.rowPayments,  value: <Money value={opts.owed} />, href: '#payments',  shown: opts.can('budget'), figure: true },
    {
      key: 'rsvp',
      label: c.rowRsvp,
      value: <Ratio of={opts.attending} total={opts.invited} />,
      href: '#guests',
      figure: true,
      shown: opts.can('guests'),
    },
    { key: 'seating',   label: c.rowSeating,   value: <Ltr>{opts.tables}</Ltr>,    href: '#seating',   shown: opts.can('seating') },
    { key: 'vendors',   label: c.rowVendors,   value: <Ltr>{opts.vendors}</Ltr>,   href: '#vendors',   shown: opts.can('vendors') },
    { key: 'meetings',  label: c.rowMeetings,  value: <Ltr>{opts.meetings}</Ltr>,  href: '#meetings',  shown: opts.can('meetings') },
    { key: 'runsheet',  label: c.rowRunsheet,  value: null,                        href: '#runsheet',  shown: opts.can('runsheet') },
    { key: 'board',     label: c.rowBoard,     value: <Ltr>{opts.saved}</Ltr>,     href: '#board',     shown: opts.can('moodboard') },
    { key: 'contracts', label: c.rowContracts, value: <Ltr>{opts.contracts}</Ltr>, href: '#contracts', shown: opts.can('contracts') },
    { key: 'venues',    label: c.rowVenues,    value: <Ltr>{opts.venues}</Ltr>,    href: '#venues',    shown: opts.can('venues') },
    { key: 'files',     label: c.rowFiles,     value: <Ltr>{opts.files}</Ltr>,     href: '#files',     shown: opts.can('files') },
    { key: 'lists',     label: c.rowLists,     value: null,                        href: '#lists',     shown: opts.can('lists') },
    { key: 'prep',      label: c.rowPrep,      value: null,                        href: '#prep',      shown: opts.can('prep') },
    { key: 'envelopes', label: c.rowEnvelopes, value: <Ltr>{opts.envelopes}</Ltr>, href: '#envelopes', shown: opts.can('envelopes') },
    { key: 'transport', label: c.rowTransport, value: <Ltr>{opts.vehicles}</Ltr>,  href: '#transport', shown: opts.can('transport') },
    { key: 'thread',    label: c.rowThread,    value: null,                        href: '#thread',    shown: opts.can('messages') },
  ];
}
