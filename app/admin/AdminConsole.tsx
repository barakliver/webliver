'use client';

import { useMemo, useState, useTransition } from 'react';
import { setFeatureFlag, setProducerStatus } from '@/app/actions/platform';
import type { FeatureFlag, Tier } from '@/lib/features';
import type { LeaderboardRow, PlatformStats } from './page';

const TIERS: { key: Tier; he: string }[] = [
  { key: 'diy', he: 'שירות עצמי' },
  { key: 'managed', he: 'הפקה מלאה' },
  { key: 'agency', he: 'סוכנות' },
];

const STATUS: Record<LeaderboardRow['status'], { he: string; cls: string }> = {
  approved: { he: 'מאושר', cls: 'badge badge-live' },
  pending: { he: 'ממתין לאישור', cls: 'badge badge-wait' },
  suspended: { he: 'מושהה', cls: 'badge badge-off' },
};

const TIER_HE: Record<Tier, string> = { diy: 'שירות עצמי', managed: 'הפקה מלאה', agency: 'סוכנות' };

export default function AdminConsole({
  email,
  stats,
  leaderboard,
  flags,
}: {
  email: string;
  stats: PlatformStats | null;
  leaderboard: LeaderboardRow[];
  flags: FeatureFlag[];
}) {
  const [rows, setRows] = useState(leaderboard);
  const [flagState, setFlagState] = useState(flags);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pendingProducers = useMemo(() => rows.filter((r) => r.status === 'pending'), [rows]);

  function changeStatus(producerId: string, status: LeaderboardRow['status']) {
    const snapshot = rows;
    setRows((current) => current.map((r) => (r.producer_id === producerId ? { ...r, status } : r)));
    setError(null);
    startTransition(async () => {
      const result = await setProducerStatus({ producerId, status });
      if (!result.ok) {
        setRows(snapshot);
        setError(result.error ?? 'העדכון נכשל.');
      }
    });
  }

  function toggleFlag(key: string, tier: Tier, enabled: boolean) {
    const column = tier === 'diy' ? 'enabled_diy' : tier === 'managed' ? 'enabled_managed' : 'enabled_agency';
    const snapshot = flagState;
    setFlagState((current) =>
      current.map((f) => (f.key === key ? { ...f, [column]: enabled } : f)),
    );
    setError(null);
    startTransition(async () => {
      const result = await setFeatureFlag({ key, tier, enabled });
      if (!result.ok) {
        setFlagState(snapshot);
        setError(result.error ?? 'השינוי לא נשמר.');
      }
    });
  }

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '26px 16px 90px' }}>
      <header style={{ marginBottom: 22 }}>
        <span className="badge badge-wait">👑 ניהול פלטפורמה</span>
        <h1 className="serif" style={{ fontSize: 27, marginTop: 8 }}>מרכז הבקרה</h1>
        <p className="muted small" dir="ltr" style={{ textAlign: 'start' }}>{email}</p>
      </header>

      <div className="alert" style={{ background: '#f6f2e9', borderInlineStart: '3px solid var(--gold)', marginBottom: 20 }}>
        <b>גבול הפרטיות.</b> המסך הזה מציג נתונים מצרפיים בלבד. אין לך גישה — גם לא טכנית — לרשימות
        מוזמנים, תקציבים, חוזים או פרטי זוגות של מפיקים עצמאיים. מדיניות ה־RLS חוסמת את זה ברמת מסד
        הנתונים, לא רק בממשק.
      </div>

      {error && <div className="alert alert-err" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── telemetry ─────────────────────────────────────────────── */}
      <section aria-labelledby="tel" className="stack" style={{ marginBottom: 30 }}>
        <h2 id="tel" style={{ fontSize: 19 }}>מדדי פלטפורמה</h2>
        {stats ? (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
              <Stat v={stats.users_total} l="משתמשים סה״כ" />
              <Stat v={stats.users_active_30d} l="פעילים ב-30 יום" tone="var(--green)" />
              <Stat v={stats.users_total - stats.users_active_30d} l="לא פעילים" tone="var(--muted)" />
              <Stat v={stats.workspaces_total} l="מרחבי אירוע" />
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
              <Stat v={stats.producers_approved} l="מפיקים מאושרים" tone="var(--green)" />
              <Stat v={stats.producers_pending} l="ממתינים לאישור" tone="var(--amber)" />
              <Stat v={stats.producers_suspended} l="מושהים" tone="var(--red)" />
              <Stat v={stats.tier_diy} l="שירות עצמי" />
              <Stat v={stats.tier_managed} l="הפקה מלאה" />
              <Stat v={stats.tier_agency} l="סוכנויות" />
            </div>
          </>
        ) : (
          <div className="card"><p className="muted">לא הצלחנו לטעון מדדים.</p></div>
        )}
      </section>

      {/* ── approval pipeline ─────────────────────────────────────── */}
      {pendingProducers.length > 0 && (
        <section aria-labelledby="pipe" className="stack" style={{ marginBottom: 30 }}>
          <h2 id="pipe" style={{ fontSize: 19 }}>
            ממתינים לאישור <span className="badge badge-wait">{pendingProducers.length}</span>
          </h2>
          {pendingProducers.map((p) => (
            <div key={p.producer_id} className="card spread">
              <div>
                <b>{p.brand_name}</b>
                <div className="muted small">
                  נרשם {new Date(p.created_at).toLocaleDateString('he-IL')} · {TIER_HE[p.tier]}
                </div>
              </div>
              <div className="row">
                <button className="btn btn-gold btn-sm" disabled={pending}
                  onClick={() => changeStatus(p.producer_id, 'approved')}>אישור</button>
                <button className="btn btn-red btn-sm" disabled={pending}
                  onClick={() => changeStatus(p.producer_id, 'suspended')}>דחייה</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── leaderboard ───────────────────────────────────────────── */}
      <section aria-labelledby="board" className="stack" style={{ marginBottom: 30 }}>
        <h2 id="board" style={{ fontSize: 19 }}>מפיקים לפי פעילות</h2>
        <p className="muted small">מספרים בלבד — שמות הלקוחות של כל מפיק אינם נגישים מכאן.</p>
        {rows.length === 0 ? (
          <div className="card"><p className="muted">עדיין אין מפיקים רשומים.</p></div>
        ) : (
          <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>{['מפיק', 'סטטוס', 'מסלול', 'מרחבים', 'פעילות 30 יום', ''].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.producer_id}>
                    <td style={td}><b>{p.brand_name}</b></td>
                    <td style={td}><span className={STATUS[p.status].cls}>{STATUS[p.status].he}</span></td>
                    <td style={td}>{TIER_HE[p.tier]}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{p.workspace_count}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{p.activity_30d}</td>
                    <td style={td}>
                      {p.status === 'suspended' ? (
                        <button className="btn btn-ghost btn-xs" disabled={pending}
                          onClick={() => changeStatus(p.producer_id, 'approved')}>הפעלה</button>
                      ) : (
                        <button className="btn btn-red btn-xs" disabled={pending}
                          onClick={() => changeStatus(p.producer_id, 'suspended')}>השהיה</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── feature gating ────────────────────────────────────────── */}
      <section aria-labelledby="flags" className="stack">
        <h2 id="flags" style={{ fontSize: 19 }}>שליטה במודולים</h2>
        <p className="muted small">איזה מודול פתוח לכל מסלול. שינוי חל מיד על כל המפיקים במסלול.</p>
        <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={th}>מודול</th>
                {TIERS.map((t) => <th key={t.key} style={{ ...th, textAlign: 'center' }}>{t.he}</th>)}
              </tr>
            </thead>
            <tbody>
              {flagState.map((f) => (
                <tr key={f.key}>
                  <td style={td}>
                    <b>{f.label_he}</b>
                    {f.description_he && <div className="muted small">{f.description_he}</div>}
                  </td>
                  {TIERS.map((t) => {
                    const column = t.key === 'diy' ? 'enabled_diy' : t.key === 'managed' ? 'enabled_managed' : 'enabled_agency';
                    const on = Boolean(f[column]);
                    return (
                      <td key={t.key} style={{ ...td, textAlign: 'center' }}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${f.label_he} — ${t.he}`}
                          disabled={pending}
                          onClick={() => toggleFlag(f.key, t.key, !on)}
                          style={{
                            width: 46, height: 26, borderRadius: 999, cursor: 'pointer',
                            border: '1px solid ' + (on ? 'var(--green)' : 'var(--line)'),
                            background: on ? 'rgba(74,107,87,.16)' : 'var(--card)',
                            position: 'relative', transition: 'background .15s',
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: 2, insetInlineStart: on ? 22 : 2,
                            width: 20, height: 20, borderRadius: 999,
                            background: on ? 'var(--green)' : 'var(--muted)',
                            transition: 'inset-inline-start .15s',
                          }} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: 'start', padding: '9px 8px', borderBottom: '1px solid var(--line)',
  fontSize: 11, letterSpacing: '.07em', color: 'var(--muted)', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px 8px', borderBottom: '1px solid var(--line)', textAlign: 'start', verticalAlign: 'top',
};

function Stat({ v, l, tone }: { v: number; l: string; tone?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 13 }}>
      <div className="serif" style={{ fontSize: 24, color: tone ?? 'inherit', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div className="muted small">{l}</div>
    </div>
  );
}
