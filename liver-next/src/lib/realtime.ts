'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';

/** A table to listen to, optionally narrowed to one workspace. */
export type LiveSource = {
  table: string;
  /** Postgres-filter syntax, e.g. `client_id=eq.<uuid>`. Narrowing at the
   *  server means the socket never carries rows this screen would discard. */
  filter?: string;
};

export type LiveStatus = 'connecting' | 'live' | 'offline';

/* How long to wait after a change before refetching. A bulk action — importing
 * a guest list, ticking off ten tasks — arrives as a burst of separate events,
 * and refetching per event would mean dozens of identical round trips for one
 * user action. Long enough to coalesce a burst, short enough to feel immediate. */
const COALESCE_MS = 250;

/* Reconnecting is the RealtimeClient's job, not ours.
 *
 * The first version of this hook rebuilt the channel itself whenever the state
 * went to CHANNEL_ERROR or CLOSED, on a backoff. That looked right and was
 * badly wrong: the client already reconnects its socket and rejoins every
 * channel on top of it, so the two loops raced. Measured against a server that
 * dropped the socket and then accepted again, the screen did recover — after
 * 729 joins in thirty seconds, each one a fresh channel with a fresh topic.
 * A quiet reconnect had turned into a flood aimed at the database.
 *
 * So the channel is built once and left alone. The status callback is for
 * reporting and for reconciliation, never for reconnecting. */

/**
 * Keeps the current screen in step with the database on every other device.
 *
 * The payload of each change is deliberately ignored. What arrives over the
 * socket is a row, but what the screen shows is the result of server components
 * that join, filter, sign storage URLs and apply their own ordering — so
 * patching the row into local state would drift from what a reload would
 * produce, and the two would disagree in ways nobody could reproduce. Instead a
 * change is treated purely as a signal that the server's answer is now stale,
 * and `router.refresh()` re-runs it. React reconciles the new tree in place, so
 * scroll position, focus and half-typed input all survive.
 *
 * Row level security applies to the socket exactly as it applies to a query, so
 * a subscription can only ever deliver rows this account may already read.
 *
 * Reconciliation matters as much as the live path. A phone that was locked, a
 * laptop that lost wifi in a venue basement, a tab left open on a train — all
 * of them miss events entirely, and no amount of retrying replays what was
 * dropped. So anything that means "we may have been away" — the tab becoming
 * visible, the network coming back, the channel being rebuilt — triggers a
 * refresh as well. Missing an event is survivable; not knowing you missed one
 * is not.
 */
export function useLive(sources: LiveSource[], enabled = true): LiveStatus {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  /* Effects must not re-run because a caller built a new array literal, which
     is every render. The identity that matters is what is being listened to. */
  const key = sources.map((s) => `${s.table}:${s.filter ?? '*'}`).sort().join('|');

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;

    const sb = supabaseBrowser();
    let stopped = false;

    const refreshSoon = () => {
      if (stopped) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), COALESCE_MS);
    };

    /* One channel, built once. Its topic is stable for a given set of sources
       so a remount reuses it rather than accumulating dead ones. */
    const channel = sb.channel(`live:${key}`);

    key.split('|').forEach((entry) => {
      const [table, filter] = entry.split(/:(.+)/);
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter && filter !== '*' ? { filter } : {}) },
        refreshSoon
      );
    });

    channel.subscribe((state) => {
      if (stopped) return;

      if (state === 'SUBSCRIBED') {
        setStatus('live');
        /* Every join has a gap behind it: on the first one the page was
           rendered before the socket existed, and on a rejoin everything that
           changed while the socket was down was never delivered. One refetch
           closes both windows, and the client rejoins for us after a drop, so
           this fires again automatically when the network comes back. */
        refreshSoon();
        return;
      }

      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
        setStatus('offline');
      }
    });

    /* Coming back from a locked phone or a closed lid. The socket may well
       still be healthy, in which case this is one wasted refetch; when it is
       not, this is the only thing that repairs the screen before the client
       has noticed anything is wrong. */
    const reconcile = () => {
      if (document.visibilityState === 'visible') refreshSoon();
    };
    const onOnline = () => refreshSoon();
    const onOffline = () => setStatus('offline');

    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (timer.current) clearTimeout(timer.current);
      sb.removeChannel(channel);
    };
  }, [key, enabled, router]);

  return status;
}

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
  ];
}
