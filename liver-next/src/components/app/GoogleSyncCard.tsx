import type { AppUi } from '@/content/appUi';
import { RefreshCw, Unlink, CalendarCheck2 } from 'lucide-react';
import { syncGoogleNow, disconnectGoogle } from '@/app/actions/google';

export type GoogleStatus = {
  email: string; ready: boolean; connected_at: string; last_sync_at: string | null; last_error: string;
};

/**
 * The link to the producer's Google account, as a card on the calendar.
 *
 * Off: one button that goes to Google. On: whose account, when it last
 * synced, a button to sync now, and one to let go. The word that comes
 * back in the address after the round trip is shown once, above.
 */
export function GoogleSyncCard({ ui, status, configured, notice }: {
  ui: AppUi; status: GoogleStatus | null; configured: boolean;
  /** The `?google=` word from the callback, or nothing. */
  notice: string;
}) {
  const c = ui.calendar.google;
  const fmt = new Intl.DateTimeFormat(ui.locale === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const line = notice === 'connected' ? c.moved : notice === 'denied' ? c.denied : notice === 'stale' ? c.stale : notice === 'failed' ? c.failed : notice === 'unconfigured' ? c.unconfigured : '';

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
          <CalendarCheck2 size={18} aria-hidden strokeWidth={1.5} />
          {c.title}
        </h2>
        {status && (
          <p className="text-[13px] text-ink-mute">
            {c.connectedAs} <span dir="ltr">{status.email || '…'}</span>
          </p>
        )}
      </div>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{status ? c.subOn : c.subOff}</p>

      {line && (
        <p role="status" className={`mt-3 rounded-xl2 px-4 py-2.5 text-[14px] ${notice === 'connected' ? 'border border-ok/25 bg-ok-wash text-ok' : 'border border-warn/25 bg-warn-wash text-warn'}`}>
          {line}
        </p>
      )}

      {!status ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {configured ? (
            <a href="/api/google/connect" className="btn-primary inline-flex items-center gap-2">{c.connect}</a>
          ) : (
            <p className="text-[13.5px] text-ink-mute">{c.unconfigured}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-[13.5px] text-ink-soft">
            {c.lastSync}: {status.last_sync_at ? fmt.format(new Date(status.last_sync_at)) : c.never}
            {status.last_error && <span className="ms-2 text-bad">· {c.error}: {status.last_error}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <form action={syncGoogleNow}>
              <button type="submit" className="btn-ghost inline-flex items-center gap-2 text-[14px]">
                <RefreshCw size={15} aria-hidden strokeWidth={1.5} />{c.syncNow}
              </button>
            </form>
            <form action={disconnectGoogle}>
              <button type="submit" className="btn-quiet inline-flex items-center gap-2 text-[14px]">
                <Unlink size={15} aria-hidden strokeWidth={1.5} />{c.disconnect}
              </button>
            </form>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-mute">{c.how}</p>
          <p className="text-[12.5px] leading-relaxed text-ink-mute">{c.rule}</p>
        </div>
      )}
    </section>
  );
}
