'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * The offline screen, which notices when it stops being true.
 *
 * Until now it asked somebody to refresh by hand once the signal came back,
 * which is a thing they had to guess had happened. The browser says so, and
 * this listens: the ring that was breathing outward stops, the mark turns into
 * a connected one, and the page goes back to where it was after a breath. The
 * reload is not instant on purpose - a screen that changes under somebody the
 * moment a bar of signal flickers is worse than the one it replaced.
 *
 * It listens for the change and never reads the state it starts in. A page
 * that believed `navigator.onLine` on arrival would reload itself on every
 * visit to a screen that was opened while the connection was fine, and
 * reload it again when it arrived; the transition is the only thing worth
 * acting on, and everybody else gets the button.
 */
export function OfflineWatcher({ copy, reload = true }: {
  /** Off only where a reload would loop, which is the harness: it is online. */
  reload?: boolean;
  copy: { offline: string; offlineBody: string; back: string; backBody: string; retry: string };
}) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    if (!online || !reload) return undefined;
    const id = setTimeout(() => window.location.reload(), 1600);
    return () => clearTimeout(id);
  }, [online, reload]);

  return (
    <div className="card" role="status">
      <div
        aria-hidden
        className={`mx-auto grid size-14 place-items-center rounded-full transition-colors duration-slow ${
          online ? 'bg-tone-rubine text-tone-rubine-on' : 'pulse-ring bg-surface-200 text-ink-soft'
        }`}
      >
        {online ? <Wifi size={24} strokeWidth={1.5} className="pop-in" /> : <WifiOff size={24} strokeWidth={1.5} />}
      </div>
      <h1 className="mt-4 font-display text-title font-light text-ink">{online ? copy.back : copy.offline}</h1>
      <p className="mt-3 text-lead leading-relaxed text-ink-soft">{online ? copy.backBody : copy.offlineBody}</p>
      <button type="button" onClick={() => window.location.reload()} className="btn-ghost mt-5">{copy.retry}</button>
    </div>
  );
}
