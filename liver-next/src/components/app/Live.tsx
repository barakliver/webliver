'use client';

import { CloudOff } from 'lucide-react';
import { useLive } from '@/lib/realtime';
import type { LiveSource } from '@/lib/liveSources';
import { appCopy } from '@/content/site';

/** Drops into any server-rendered page to make it live. Renders nothing while
 *  the connection is healthy — the whole point is that staying in step is not
 *  something anybody should have to think about.
 *
 *  It speaks up in one case only: the connection is gone, so what is on screen
 *  may already be behind. Saying so is the difference between a screen that is
 *  briefly stale and a producer acting on a task somebody else finished ten
 *  minutes ago. */
export function Live({ sources }: { sources: LiveSource[] }) {
  const status = useLive(sources);
  if (status !== 'offline') return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 flex justify-center px-4 lg:bottom-6"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ivory-100 px-3.5 py-2 text-[13px] text-ink-soft shadow-soft">
        <CloudOff size={15} aria-hidden strokeWidth={1.75} />
        {appCopy.live.offline}
      </span>
    </div>
  );
}
