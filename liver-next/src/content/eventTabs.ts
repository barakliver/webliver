/** The sections of an event file, in the order somebody works through one.
 *  Pure on purpose: the tabs component reads a cookie, and the quick search
 *  in the browser needs only this list. */
export const EVENT_TABS = ['overview', 'tasks', 'venues', 'day', 'guests', 'details', 'crew', 'bar', 'money', 'docs', 'files', 'meetings', 'messages', 'board', 'prep'] as const;
export type EventTab = (typeof EVENT_TABS)[number];

export const readTab = (raw: string | undefined): EventTab =>
  (EVENT_TABS as readonly string[]).includes(raw ?? '') ? (raw as EventTab) : 'overview';
