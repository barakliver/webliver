/** The sections of an event file, in the order somebody works through one.
 *  Pure on purpose: the tabs component reads a cookie, and the quick search
 *  in the browser needs only this list. */
export const EVENT_TABS = ['overview', 'profile', 'tasks', 'venues', 'day', 'guests', 'details', 'crew', 'bar', 'money', 'docs', 'files', 'meetings', 'messages', 'board', 'prep'] as const;
export type EventTab = (typeof EVENT_TABS)[number];

export const readTab = (raw: string | undefined): EventTab =>
  (EVENT_TABS as readonly string[]).includes(raw ?? '') ? (raw as EventTab) : 'overview';

/** The same sixteen, in four groups, for the rail beside the file. The order
 *  of work above stays as it was for the quick search; this is the order of
 *  the question somebody came with: what is the plan, who is in it, what does
 *  it cost and where is the paper, and what has been said. Every tab is in
 *  exactly one group, and a test holds that. */
export const EVENT_TAB_GROUPS = [
  { key: 'plan', tabs: ['overview', 'tasks', 'day', 'details', 'venues'] },
  { key: 'people', tabs: ['profile', 'guests', 'crew', 'bar'] },
  { key: 'money', tabs: ['money', 'docs', 'files'] },
  { key: 'talk', tabs: ['meetings', 'messages', 'board', 'prep'] },
] as const satisfies readonly { key: string; tabs: readonly (typeof EVENT_TABS)[number][] }[];
