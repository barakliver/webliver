import type { EventTab } from '@/content/eventTabs';
import type { PortalCopy } from '@/content/appUi';

/**
 * The sections of the couple's screen, each with the producer's tab it is
 * the other side of.
 *
 * One list, read by four things: the couple's own screen, the producer's
 * preview of it, the switches the producer flips, and the couple's assistant
 * when it decides what it may talk about. The key is the one the plan gate
 * already uses (`feature_on`), so a section is closed either by the plan or
 * by the producer, through one function, and no screen has to ask twice.
 *
 * Pure on purpose: this is imported by client components.
 */
export type PortalSection = {
  key: string;
  /** Where the producer works on the same rows. */
  tab: EventTab;
  /** The label on the couple's screen, so the switch and the section it
   *  controls are called the same thing. */
  row: keyof PortalCopy;
  /** Gated in the database on clients.budget_visible rather than in the
   *  switches column. */
  money?: true;
};

export const PORTAL_SECTIONS: readonly PortalSection[] = [
  { key: 'tasks',     tab: 'tasks',    row: 'rowTasks' },
  { key: 'budget',    tab: 'money',    row: 'rowBudget', money: true },
  { key: 'guests',    tab: 'guests',   row: 'rowRsvp' },
  { key: 'seating',   tab: 'guests',   row: 'rowSeating' },
  { key: 'vendors',   tab: 'crew',     row: 'rowVendors' },
  { key: 'runsheet',  tab: 'day',      row: 'rowRunsheet' },
  { key: 'moodboard', tab: 'board',    row: 'rowBoard' },
  { key: 'contracts', tab: 'docs',     row: 'rowContracts' },
  { key: 'venues',    tab: 'venues',   row: 'rowVenues' },
  { key: 'files',     tab: 'files',    row: 'rowFiles' },
  { key: 'lists',     tab: 'details',  row: 'rowLists' },
  { key: 'prep',      tab: 'prep',     row: 'rowPrep' },
  { key: 'envelopes', tab: 'prep',     row: 'rowEnvelopes' },
  { key: 'transport', tab: 'prep',     row: 'rowTransport' },
  { key: 'messages',  tab: 'messages', row: 'rowThread' },
];

export const SECTION_KEYS: readonly string[] = PORTAL_SECTIONS.map((s) => s.key);

export const sectionsOfTab = (tab: EventTab): PortalSection[] =>
  PORTAL_SECTIONS.filter((s) => s.tab === tab);

/** What the column holds: only explicit closures. */
export type SharedSections = Record<string, boolean>;

/** Absent means open. The column starts empty, so a couple sees today what
 *  they saw before the switches existed. */
export const sectionOpen = (shares: SharedSections | null | undefined, key: string): boolean =>
  shares?.[key] !== false;

/** The column as the application reads it, whatever the database sent:
 *  null on an old row, a string from a driver that did not parse it, or
 *  something that is not an object at all. */
export function readShares(raw: unknown): SharedSections {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: SharedSections = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  }
  return {};
}
