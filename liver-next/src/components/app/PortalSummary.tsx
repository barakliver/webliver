import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Ltr, Money, Ratio } from '@/components/Ltr';
import { appCopy } from '@/content/site';

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
};

export function PortalSummary({ rows }: { rows: SummaryRow[] }) {
  const live = rows.filter((r) => r.shown);
  if (live.length === 0) return null;

  return (
    <nav aria-label={appCopy.portal.summary} className="mt-10">
      <ul className="list-none p-0">
        {live.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className="flex min-h-[64px] items-center justify-between gap-4 border-t border-line
                         transition-colors duration-300 hover:bg-surface-100"
            >
              <span className="text-[15.5px] text-ink">{r.label}</span>
              <span className="flex items-center gap-3">
                <span className="font-display text-[22px] font-light text-ink">{r.value}</span>
                {/* Points the way the language runs. In a right-to-left page
                    a chevron aimed right is aimed backwards. */}
                <ChevronLeft size={16} strokeWidth={1.5} className="text-ink-mute" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-line" />
    </nav>
  );
}

/** Builds the four rows from the workspace's own data. Kept beside the
 *  component so the labels and the figures cannot drift apart. */
export function summaryRows(opts: {
  budget: number | null;
  attending: number; invited: number;
  saved: number; vendors: number;
  can: (key: string) => boolean;
}): SummaryRow[] {
  const c = appCopy.portal;
  return [
    {
      key: 'budget',
      label: c.rowBudget,
      value: opts.budget === null ? <Ltr>0</Ltr> : <Money value={opts.budget} />,
      href: '#budget',
      shown: opts.can('budget'),
    },
    {
      key: 'rsvp',
      label: c.rowRsvp,
      value: <Ratio of={opts.attending} total={opts.invited} />,
      href: '#guests',
      shown: opts.can('guests'),
    },
    {
      key: 'board',
      label: c.rowBoard,
      value: <Ltr>{opts.saved.toLocaleString('en-US')}</Ltr>,
      href: '#board',
      shown: opts.can('moodboard'),
    },
    {
      key: 'vendors',
      label: c.rowVendors,
      value: <Ltr>{opts.vendors.toLocaleString('en-US')}</Ltr>,
      href: '#runsheet',
      shown: opts.can('runsheet'),
    },
  ];
}
