'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AUDIENCE_LABELS,
  countdownMs,
  filterTimeline,
  splitCountdown,
  type TimelineAudience,
  type TimelineEntry,
} from '@/lib/domain/timeline';

/**
 * Day-of operations: live countdown, role-filtered PDF export, and a webcal
 * subscription link.
 *
 * The PDF is produced through the browser's own print pipeline rather than a
 * server-side renderer. That is deliberate: the timeline is Hebrew RTL, and
 * PDF libraries need an embedded Hebrew font plus manual bidi handling to get
 * it right, while the browser already shapes and orders the text correctly.
 * "Save as PDF" in the print dialog produces a selectable, correctly ordered
 * document; a print stylesheet controls the page layout.
 */

interface Props {
  clientId: string;
  eventName: string;
  eventDate: string | null;
  venue: string | null;
  entries: TimelineEntry[];
  /** From event_settings; enables the webcal:// subscription link. */
  calendarToken?: string | null;
  siteUrl: string;
}

const AUDIENCES: TimelineAudience[] = ['all', 'couple', 'photo', 'crew'];

export default function TimelinePdfExporter({
  eventName,
  eventDate,
  venue,
  entries,
  calendarToken,
  siteUrl,
}: Props) {
  const [audience, setAudience] = useState<TimelineAudience>('all');
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => filterTimeline(entries, audience), [entries, audience]);

  const target = useMemo(() => {
    if (!eventDate) return null;
    const d = new Date(`${eventDate}T19:00:00+02:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [eventDate]);

  const [remaining, setRemaining] = useState(() => countdownMs(target));
  useEffect(() => {
    setRemaining(countdownMs(target));
    if (!target) return;
    const id = setInterval(() => setRemaining(countdownMs(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const clock = splitCountdown(remaining);

  // webcal:// makes Apple/Google/Outlook subscribe rather than import, so the
  // event updates in place if the date moves.
  const feedPath = calendarToken ? `/api/calendar/${calendarToken}` : null;
  const httpsFeed = feedPath ? `${siteUrl.replace(/\/$/, '')}${feedPath}` : null;
  const webcalFeed = httpsFeed ? httpsFeed.replace(/^https?:\/\//, 'webcal://') : null;

  async function copyFeed() {
    if (!httpsFeed) return;
    try {
      await navigator.clipboard.writeText(httpsFeed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is visible on screen anyway */
    }
  }

  return (
    <section className="stack" aria-labelledby="timeline-title">
      <div className="no-print">
        <h2 id="timeline-title" style={{ fontSize: 22 }}>
          ⏱ יום האירוע
        </h2>
        <p className="muted small">ספירה לאחור, לוח זמנים לפי תפקיד, וסנכרון ליומן.</p>
      </div>

      {target && (
        <div className="card no-print" style={{ textAlign: 'center' }}>
          <div className="muted small">הספירה לאחור</div>
          <div
            className="row"
            style={{ justifyContent: 'center', gap: 18, marginTop: 8 }}
            role="timer"
            aria-live="off"
          >
            {[
              { v: clock.days, l: 'ימים' },
              { v: clock.hours, l: 'שעות' },
              { v: clock.minutes, l: 'דקות' },
              { v: clock.seconds, l: 'שניות' },
            ].map((unit) => (
              <div key={unit.l}>
                <div className="serif" style={{ fontSize: 30, color: 'var(--gold)' }}>
                  {String(unit.v).padStart(2, '0')}
                </div>
                <div className="muted small">{unit.l}</div>
              </div>
            ))}
          </div>
          {remaining === 0 && (
            <p className="small" style={{ marginTop: 8 }}>
              🎉 היום הגיע.
            </p>
          )}
        </div>
      )}

      <div className="row no-print" role="group" aria-label="סינון לפי תפקיד">
        {AUDIENCES.map((key) => (
          <button
            key={key}
            type="button"
            className="chip"
            aria-pressed={audience === key}
            onClick={() => setAudience(key)}
          >
            {AUDIENCE_LABELS[key].he}
          </button>
        ))}
      </div>

      <div className="row no-print">
        <button
          type="button"
          className="btn btn-gold btn-sm"
          onClick={() => window.print()}
          disabled={rows.length === 0}
        >
          🖨 ייצוא PDF ({AUDIENCE_LABELS[audience].he})
        </button>
        {webcalFeed && (
          <>
            <a className="btn btn-dark btn-sm" href={webcalFeed}>
              📅 הוספה ליומן
            </a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyFeed()}>
              {copied ? '✓ הועתק' : 'העתקת קישור היומן'}
            </button>
          </>
        )}
      </div>

      {!calendarToken && (
        <p className="muted small no-print">
          כדי לאפשר סנכרון ליומן, שמרו את שעת האירוע בהגדרות האירוע.
        </p>
      )}

      {/* This block is what actually prints. */}
      <div className="card">
        <header style={{ marginBottom: 14 }}>
          <h3 className="serif" style={{ fontSize: 20 }}>
            לוח זמנים ליום האירוע
          </h3>
          <p className="muted small">
            {eventName}
            {eventDate ? ` · ${new Date(eventDate).toLocaleDateString('he-IL')}` : ''}
            {venue ? ` · ${venue}` : ''} · {AUDIENCE_LABELS[audience].he}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="muted">אין שלבים מתאימים לתפקיד הזה.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['שעה', 'שלב', 'אחראי', 'מיקום'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'start',
                        padding: '9px 6px',
                        borderBottom: '1px solid var(--line)',
                        fontSize: 11,
                        letterSpacing: '.08em',
                        color: 'var(--muted)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, i) => (
                  <tr key={`${entry.time}-${i}`}>
                    <td style={{ ...cell, fontWeight: 700, whiteSpace: 'nowrap', width: 78 }}>
                      {entry.time}
                    </td>
                    <td style={cell}>
                      {entry.title}
                      {entry.notes && <div className="muted small">{entry.notes}</div>}
                    </td>
                    <td style={cell}>{entry.owner ?? '—'}</td>
                    <td style={cell}>{entry.location ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const cell: React.CSSProperties = {
  padding: '9px 6px',
  borderBottom: '1px solid var(--line)',
  textAlign: 'start',
  verticalAlign: 'top',
};
