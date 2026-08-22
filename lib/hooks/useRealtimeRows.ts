'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database, RealtimeTable } from '@/lib/supabase/database.types';

type Row<T extends RealtimeTable> = Database['public']['Tables'][T]['Row'];

export type ConnectionState = 'connecting' | 'live' | 'error';

interface Options<T extends RealtimeTable> {
  table: T;
  clientId: string;
  initial: Row<T>[];
  /** Applied after every change so the list keeps a stable order. */
  sort?: (a: Row<T>, b: Row<T>) => number;
}

interface Result<T extends RealtimeTable> {
  rows: Row<T>[];
  status: ConnectionState;
  /** Optimistic local write; the realtime echo reconciles it. */
  setRows: React.Dispatch<React.SetStateAction<Row<T>[]>>;
  refresh: () => Promise<void>;
}

/**
 * Subscribes one table, scoped to a single workspace, and keeps a local array
 * in sync across every device viewing it.
 *
 * Rows are keyed by id, so an optimistic insert made locally is replaced —
 * not duplicated — when its INSERT event arrives. DELETE relies on
 * REPLICA IDENTITY FULL (set in the migration) to carry the removed row's id.
 */
export function useRealtimeRows<T extends RealtimeTable>({
  table,
  clientId,
  initial,
  sort,
}: Options<T>): Result<T> {
  const [rows, setRows] = useState<Row<T>[]>(initial);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const sortRef = useRef(sort);
  sortRef.current = sort;

  const apply = useCallback((next: Row<T>[]): Row<T>[] => {
    const s = sortRef.current;
    return s ? next.slice().sort(s) : next;
  }, []);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from(table).select('*').eq('client_id', clientId);
    if (!error && data) setRows(apply(data as Row<T>[]));
  }, [table, clientId, apply]);

  useEffect(() => {
    setRows((current) => apply(current));
    // `initial` is a server-rendered snapshot; re-sorting it is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    channel = supabase
      .channel(`${table}:${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `client_id=eq.${clientId}` },
        (payload) => {
          if (cancelled) return;
          setRows((current) => {
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Partial<Row<T>>;
              if (!oldRow?.id) return current;
              return apply(current.filter((r) => r.id !== oldRow.id));
            }
            const fresh = payload.new as Row<T>;
            if (!fresh?.id) return current;
            const index = current.findIndex((r) => r.id === fresh.id);
            if (index === -1) return apply([...current, fresh]);
            const next = current.slice();
            next[index] = fresh;
            return apply(next);
          });
        },
      )
      .subscribe((state) => {
        if (cancelled) return;
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('error');
      });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [table, clientId, apply]);

  return { rows, status, setRows, refresh };
}
