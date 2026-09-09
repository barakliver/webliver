/* ── Which tables a screen listens to ──────────────────────────────────────
   A plain module, deliberately, and this is the second time the lesson has
   been paid for on this page.

   The list itself is data: a few table names and filters. It was living in
   realtime.ts, which begins with 'use client', and a server component called
   workspaceSources() to build its own list. On the server, every export of a
   'use client' module is a reference to something that lives in the browser,
   not the thing itself — so the call threw and took the whole event screen
   down with it.

   The mirror image of that mistake took the same page down a week earlier: a
   'use server' file exporting a constant that a browser component imported.
   Both have the same shape. Data that both sides read belongs in a module that
   claims neither side.                                                       */

/** A table to listen to, optionally narrowed to one workspace. */
export type LiveSource = {
  table: string;
  /** Postgres-filter syntax, e.g. `client_id=eq.<uuid>`. Narrowing at the
   *  server means the socket never carries rows this screen would discard. */
  filter?: string;
};

/** Everything one event workspace is made of. Filtering server-side means a
 *  producer with forty events open on a laptop is not carrying forty events'
 *  worth of traffic for the one screen they are looking at. */
export function workspaceSources(clientId: string): LiveSource[] {
  const of = (table: string): LiveSource => ({ table, filter: `client_id=eq.${clientId}` });
  return [
    { table: 'clients', filter: `id=eq.${clientId}` },
    of('tasks'),
    of('guests_rsvp'),
    of('tables_seating'),
    of('moodboards'),
    of('day_schedule'),
    of('budget_items'),
    of('payments'),
    of('client_authorized_emails'),
    of('messages'),
    of('contracts'),
  ];
}

/** The tables a couple's screen is built from. Unfiltered: row level security
 *  already scopes each of them to the workspaces they were invited to. */
export const PORTAL_LIVE_SOURCES: LiveSource[] = [
  { table: 'clients' }, { table: 'tasks' }, { table: 'guests_rsvp' },
  { table: 'tables_seating' }, { table: 'moodboards' }, { table: 'day_schedule' },
  { table: 'budget_items' }, { table: 'payments' },
  { table: 'messages' }, { table: 'contracts' },
];
