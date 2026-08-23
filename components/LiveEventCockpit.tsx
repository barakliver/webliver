'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  addVendorCheckin,
  broadcastToVendors,
  setVendorStatus,
} from '@/app/actions/platform';
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows';
import { filterTimeline, toMinutes, type TimelineEntry } from '@/lib/domain/timeline';
import { ConnectionBadge } from './BrideMode';
import type { VendorCheckinRow, VendorRole } from '@/lib/supabase/database.types';

/**
 * Day-of operations cockpit — חמ"ל ספקים
 *
 * Built for one situation: the producer standing at the venue with a phone in
 * one hand. Large touch targets, the next transition always on screen, and an
 * alert 10 minutes before every major moment.
 */

const ROLES: { key: VendorRole; he: string; icon: string }[] = [
  { key: 'catering', he: 'קייטרינג', icon: '🍽' },
  { key: 'sound', he: 'סאונד', icon: '🔊' },
  { key: 'lighting', he: 'תאורה', icon: '💡' },
  { key: 'dj', he: 'דיג׳יי', icon: '🎧' },
  { key: 'band', he: 'להקה', icon: '🎸' },
  { key: 'photo', he: 'צילום סטילס', icon: '📷' },
  { key: 'video', he: 'וידאו', icon: '🎥' },
  { key: 'magnets', he: 'מגנטים', icon: '🧲' },
  { key: 'design', he: 'עיצוב', icon: '🎨' },
  { key: 'flowers', he: 'פרחים', icon: '🌸' },
  { key: 'rabbi', he: 'רב', icon: '📜' },
  { key: 'security', he: 'אבטחה', icon: '🛡' },
  { key: 'transport', he: 'הסעות', icon: '🚐' },
  { key: 'other', he: 'אחר', icon: '📦' },
];
const ROLE_MAP = new Map(ROLES.map((r) => [r.key, r]));

const STATUS: Record<VendorCheckinRow['status'], { he: string; cls: string }> = {
  expected: { he: 'ממתין', cls: 'badge badge-wait' },
  arrived: { he: 'הגיע', cls: 'badge badge-live' },
  late: { he: 'מאחר', cls: 'badge badge-off' },
  no_show: { he: 'לא הגיע', cls: 'badge badge-off' },
};

/** Stages that warrant a 10-minute heads-up. */
const MAJOR = /(חופה|כניסת|ריקוד|סלואו|רחבה|מנה|הגשה|ברכות|שבירת|chuppah|first dance|meal|speech)/i;

const ALERT_LEAD_MINUTES = 10;

interface Props {
  clientId: string;
  eventName: string;
  entries: TimelineEntry[];
  initialVendors: VendorCheckinRow[];
}

export default function LiveEventCockpit({ clientId, eventName, entries, initialVendors }: Props) {
  const vendors = useRealtimeRows({
    table: 'vendor_checkins',
    clientId,
    initial: initialVendors,
    sort: (a, b) => a.vendor_name.localeCompare(b.vendor_name, 'he'),
  });

  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const schedule = useMemo(() => filterTimeline(entries, 'all'), [entries]);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const next = useMemo(
    () => schedule.find((entry) => toMinutes(entry.time) >= minutesNow) ?? null,
    [schedule, minutesNow],
  );
  const minutesToNext = next ? toMinutes(next.time) - minutesNow : null;

  /** Stages inside the alert window that we have not announced yet. */
  const imminent = useMemo(
    () =>
      schedule.filter((entry) => {
        const delta = toMinutes(entry.time) - minutesNow;
        return delta >= 0 && delta <= ALERT_LEAD_MINUTES && MAJOR.test(entry.title);
      }),
    [schedule, minutesNow],
  );

  useEffect(() => {
    for (const entry of imminent) {
      const key = `${entry.time}-${entry.title}`;
      if (announced.current.has(key)) continue;
      announced.current.add(key);
      // Vibration is the only channel that reliably reaches a producer whose
      // phone is in a pocket in a loud room.
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* unsupported — the on-screen banner still shows */
      }
    }
  }, [imminent]);

  const counts = useMemo(() => {
    const rows = vendors.rows;
    return {
      total: rows.length,
      arrived: rows.filter((v) => v.status === 'arrived').length,
      late: rows.filter((v) => v.status === 'late').length,
      missing: rows.filter((v) => v.status === 'expected' || v.status === 'no_show').length,
    };
  }, [vendors.rows]);

  function mark(id: string, status: VendorCheckinRow['status']) {
    const snapshot = vendors.rows;
    vendors.setRows((current) =>
      current.map((v) =>
        v.id === id
          ? { ...v, status, arrived_at: status === 'arrived' ? new Date().toISOString() : null }
          : v,
      ),
    );
    setError(null);
    startTransition(async () => {
      const result = await setVendorStatus({ clientId, id, status });
      if (!result.ok) {
        vendors.setRows(snapshot);
        setError(result.error ?? 'העדכון נכשל.');
      }
    });
  }

  function send() {
    const text = message.trim();
    if (text.length < 2) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await broadcastToVendors({ clientId, message: text });
      if (!result.ok) {
        setError(result.error ?? 'השליחה נכשלה.');
        return;
      }
      const { recipients, delivered, pendingProvider } = result.data!;
      setNotice(
        pendingProvider
          ? `ההודעה נרשמה ל-${recipients} ספקים, אבל ערוץ הוואטסאפ עדיין לא מחובר — היא לא נשלחה בפועל.`
          : `נשלח ל-${delivered} מתוך ${recipients} ספקים.`,
      );
      setMessage('');
      setBroadcastOpen(false);
    });
  }

  return (
    <section className="stack" aria-labelledby="cockpit-title">
      <div className="spread">
        <div>
          <h2 id="cockpit-title" style={{ fontSize: 22 }}>🎛 חמ״ל יום האירוע</h2>
          <p className="muted small">{eventName}</p>
        </div>
        <ConnectionBadge status={vendors.status} />
      </div>

      {/* ── imminent-stage alert ───────────────────────────────────── */}
      {imminent.length > 0 && (
        <div
          role="alert"
          className="card"
          style={{ borderColor: 'var(--amber)', background: 'rgba(181,138,60,.1)' }}
        >
          <b style={{ fontSize: 17 }}>⏰ עוד רגע: {imminent[0]!.title}</b>
          <div className="muted small" style={{ marginTop: 2 }}>
            {imminent[0]!.time} · בעוד {Math.max(0, toMinutes(imminent[0]!.time) - minutesNow)} דקות
            {imminent[0]!.owner ? ` · ${imminent[0]!.owner}` : ''}
          </div>
        </div>
      )}

      {/* ── next transition ────────────────────────────────────────── */}
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="muted small">השלב הבא</div>
        {next ? (
          <>
            <div className="serif" style={{ fontSize: 25, marginTop: 4 }}>{next.title}</div>
            <div style={{ fontSize: 15, marginTop: 2 }}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{next.time}</b>
              <span className="muted"> · בעוד {minutesToNext} דקות</span>
            </div>
            {next.owner && <div className="muted small" style={{ marginTop: 2 }}>{next.owner}</div>}
          </>
        ) : (
          <div className="serif" style={{ fontSize: 21, marginTop: 4 }}>לוח הזמנים הסתיים 🎉</div>
        )}
      </div>

      {/* ── vendor tally ───────────────────────────────────────────── */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(94px,1fr))' }}>
        <Tally n={counts.arrived} l="הגיעו" tone="var(--green)" />
        <Tally n={counts.late} l="מאחרים" tone="var(--red)" />
        <Tally n={counts.missing} l="טרם" tone="var(--amber)" />
        <Tally n={counts.total} l="סה״כ" />
      </div>

      {error && <div className="alert alert-err" role="alert">{error}</div>}
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}

      {/* ── emergency broadcast ────────────────────────────────────── */}
      {broadcastOpen ? (
        <div className="card stack" style={{ borderColor: 'var(--red)' }}>
          <b>הודעת חירום לכל הספקים באתר</b>
          <textarea
            rows={3}
            maxLength={600}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="למשל: החופה נדחית ב-20 דקות, כולם להיערך מחדש."
            aria-label="תוכן ההודעה"
          />
          <div className="row">
            <button className="btn btn-red" disabled={pending || message.trim().length < 2} onClick={send}>
              שליחה ל-{counts.total - counts.missing + counts.arrived > 0 ? counts.total : 0} ספקים
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBroadcastOpen(false)}>ביטול</button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-red"
          style={{ width: '100%', padding: '15px 20px', fontSize: 16 }}
          onClick={() => setBroadcastOpen(true)}
        >
          📣 הודעת חירום לכל הספקים
        </button>
      )}

      {/* ── vendor check-in list ───────────────────────────────────── */}
      <VendorList
        clientId={clientId}
        rows={vendors.rows}
        pending={pending}
        onMark={mark}
        onAdded={() => void vendors.refresh()}
        onError={setError}
      />
    </section>
  );
}

function Tally({ n, l, tone }: { n: number; l: string; tone?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 11 }}>
      <div className="serif" style={{ fontSize: 22, color: tone ?? 'inherit', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div className="muted small">{l}</div>
    </div>
  );
}

function VendorList({
  clientId,
  rows,
  pending,
  onMark,
  onAdded,
  onError,
}: {
  clientId: string;
  rows: VendorCheckinRow[];
  pending: boolean;
  onMark: (id: string, status: VendorCheckinRow['status']) => void;
  onAdded: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<VendorRole>('catering');
  const [phone, setPhone] = useState('');
  const [open, setOpen] = useState(false);

  async function add() {
    if (!name.trim()) return;
    const result = await addVendorCheckin({
      clientId,
      role,
      vendor_name: name.trim(),
      phone: phone.trim() || undefined,
    });
    if (!result.ok) onError(result.error ?? 'ההוספה נכשלה.');
    else {
      setName('');
      setPhone('');
      setOpen(false);
      onAdded();
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <b style={{ fontSize: 16 }}>צ׳ק־אין ספקים</b>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'סגירה' : '+ ספק'}
        </button>
      </div>

      {open && (
        <div className="card stack">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
            <div>
              <label htmlFor="v-role">תפקיד</label>
              <select id="v-role" value={role} onChange={(e) => setRole(e.target.value as VendorRole)}>
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.he}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="v-name">שם הספק</label>
              <input id="v-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="v-phone">טלפון</label>
              <input id="v-phone" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-gold btn-sm" onClick={() => void add()}>הוספה</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <p className="muted">עדיין לא נוספו ספקים לאירוע הזה.</p>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', gap: 9 }}>
          {rows.map((v) => {
            const meta = ROLE_MAP.get(v.role);
            const st = STATUS[v.status];
            return (
              <li key={v.id} className="card" style={{ padding: 13 }}>
                <div className="spread" style={{ gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{meta?.icon} {v.vendor_name}</b> <span className={st.cls}>{st.he}</span>
                    <div className="muted small">
                      {meta?.he}
                      {v.arrived_at ? ` · הגיע ב-${new Date(v.arrived_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>
                  </div>
                  {v.phone && (
                    <a className="btn btn-ghost btn-xs" href={`tel:${v.phone}`} aria-label={`חיוג ל${v.vendor_name}`}>📞</a>
                  )}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className={`btn btn-sm ${v.status === 'arrived' ? 'btn-dark' : 'btn-ghost'}`}
                    style={{ flex: 1 }} disabled={pending}
                    onClick={() => onMark(v.id, 'arrived')}
                  >✓ הגיע</button>
                  <button
                    className={`btn btn-sm ${v.status === 'late' ? 'btn-dark' : 'btn-ghost'}`}
                    style={{ flex: 1 }} disabled={pending}
                    onClick={() => onMark(v.id, 'late')}
                  >⏳ מאחר</button>
                  <button
                    className={`btn btn-sm ${v.status === 'no_show' ? 'btn-dark' : 'btn-ghost'}`}
                    style={{ flex: 1 }} disabled={pending}
                    onClick={() => onMark(v.id, 'no_show')}
                  >✕ לא הגיע</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
