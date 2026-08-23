import { redirect } from 'next/navigation';
import { getSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { getBrand, brandStyle } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

interface Funnel {
  visits: number;
  leads: number;
  consults: number;
  signed: number;
  lost: number;
  signed_value: number;
  avg_response_minutes: number | null;
}

interface Cashflow {
  planned: number;
  collected: number;
  pending: number;
  overdue_items: number;
}

const ils = (n: number) => `₪${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/**
 * Producer business intelligence.
 *
 * Every figure is scoped to the caller's own tenant by the RPCs themselves —
 * `current_tenant_id()` is derived from the session, never from a parameter, so
 * there is no tenant id a caller could tamper with to see someone else's numbers.
 */
export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/analytics');

  const supabase = await getSupabaseServerClient();
  const brand = await getBrand();

  const { data: producer } = await supabase
    .from('producers')
    .select('id,brand_name,status,tier')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (!producer) {
    return (
      <Shell brand={brand}>
        <div className="card">
          <h1 className="serif" style={{ fontSize: 22 }}>אין עדיין פרופיל מפיק</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            החשבון הזה לא משויך לעסק הפקה. פנו למנהל הפלטפורמה כדי לפתוח פרופיל.
          </p>
        </div>
      </Shell>
    );
  }

  if (producer.status !== 'approved') {
    return (
      <Shell brand={brand}>
        <div className="card">
          <span className="badge badge-wait">{producer.status === 'pending' ? 'ממתין לאישור' : 'מושהה'}</span>
          <h1 className="serif" style={{ fontSize: 22, marginTop: 8 }}>{producer.brand_name}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {producer.status === 'pending'
              ? 'החשבון ממתין לאישור. הדוחות ייפתחו מיד לאחר האישור.'
              : 'החשבון מושהה. פנו למנהל הפלטפורמה.'}
          </p>
        </div>
      </Shell>
    );
  }

  const [funnelRes, cashRes, overdueRes] = await Promise.all([
    supabase.rpc('producer_funnel', { p_days: 90 }),
    supabase.rpc('producer_cashflow'),
    supabase.from('clients').select('id,display_name,event_date').order('event_date', { ascending: true }).limit(200),
  ]);

  const funnel = (funnelRes.data ?? null) as Funnel | null;
  const cash = (cashRes.data ?? null) as Cashflow | null;

  const stages = funnel
    ? [
        { key: 'visits', he: 'מבקרים באתר', n: funnel.visits },
        { key: 'leads', he: 'פניות', n: funnel.leads },
        { key: 'consults', he: 'שיחות ייעוץ', n: funnel.consults },
        { key: 'signed', he: 'חוזים חתומים', n: funnel.signed },
      ]
    : [];
  const top = stages.length > 0 ? Math.max(...stages.map((s) => s.n), 1) : 1;

  const conversion =
    funnel && funnel.leads > 0 ? Math.round((funnel.signed / funnel.leads) * 100) : 0;
  const collectionRate =
    cash && Number(cash.planned) > 0
      ? Math.round((Number(cash.collected) / Number(cash.planned)) * 100)
      : 0;

  const responseMinutes = funnel?.avg_response_minutes ?? null;
  const responseTone =
    responseMinutes === null ? 'var(--muted)'
      : responseMinutes <= 60 ? 'var(--green)'
      : responseMinutes <= 240 ? 'var(--amber)'
      : 'var(--red)';

  return (
    <Shell brand={brand}>
      <header style={{ marginBottom: 22 }}>
        <h1 className="serif" style={{ fontSize: 26 }}>דוחות עסקיים</h1>
        <p className="muted small">{producer.brand_name} · 90 הימים האחרונים</p>
      </header>

      {/* ── funnel ────────────────────────────────────────────────── */}
      <section className="stack" style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 19 }}>משפך המרה</h2>
        {!funnel || stages.every((s) => s.n === 0) ? (
          <div className="card">
            <p className="muted">
              עדיין אין נתוני משפך. כל פנייה חדשה, שיחת ייעוץ וחוזה חתום ייכנסו לכאן אוטומטית.
            </p>
          </div>
        ) : (
          <div className="card stack">
            {stages.map((s, i) => {
              const prev = i > 0 ? stages[i - 1]!.n : null;
              const dropoff = prev && prev > 0 ? Math.round((s.n / prev) * 100) : null;
              return (
                <div key={s.key}>
                  <div className="spread" style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: 14 }}>
                      {s.he}
                      {dropoff !== null && (
                        <span className="muted small" style={{ marginInlineStart: 8 }}>
                          {dropoff}% מהשלב הקודם
                        </span>
                      )}
                    </span>
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.n}</b>
                  </div>
                  <div style={{ height: 10, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(2, (s.n / top) * 100)}%`, height: '100%',
                      background: i === stages.length - 1 ? 'var(--green)' : 'var(--gold)',
                    }} />
                  </div>
                </div>
              );
            })}
            <div className="spread" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span className="muted small">שיעור סגירה מפנייה לחוזה</span>
              <b style={{ fontSize: 17, color: 'var(--gold)' }}>{conversion}%</b>
            </div>
          </div>
        )}
      </section>

      {/* ── cash health ───────────────────────────────────────────── */}
      <section className="stack" style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 19 }}>בריאות תזרים</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          <Stat v={ils(cash?.planned ?? 0)} l="היקף מתוכנן" />
          <Stat v={ils(cash?.collected ?? 0)} l="נגבה" tone="var(--green)" />
          <Stat v={ils(cash?.pending ?? 0)} l="ממתין לגבייה" tone="var(--gold)" />
          <Stat v={ils(funnel?.signed_value ?? 0)} l="שווי חוזים שנחתמו" />
        </div>
        <div className="card">
          <div className="spread" style={{ marginBottom: 6 }}>
            <span className="small">שיעור גבייה</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{collectionRate}%</b>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, collectionRate)}%`, height: '100%',
              background: collectionRate >= 70 ? 'var(--green)' : collectionRate >= 40 ? 'var(--amber)' : 'var(--red)',
            }} />
          </div>
        </div>
      </section>

      {/* ── bottlenecks ───────────────────────────────────────────── */}
      <section className="stack">
        <h2 style={{ fontSize: 19 }}>צווארי בקבוק</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <div className="card">
            <div className="muted small">זמן תגובה ממוצע לפנייה</div>
            <div className="serif" style={{ fontSize: 25, color: responseTone, marginTop: 4 }}>
              {responseMinutes === null ? '—' : formatMinutes(responseMinutes)}
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>
              {responseMinutes === null
                ? 'עדיין אין מספיק נתונים.'
                : responseMinutes <= 60
                  ? 'מצוין — תגובה תוך שעה מכפילה סיכוי לסגירה.'
                  : 'פנייה שממתינה מעל שעה מאבדת חלק ניכר מהסיכוי להיסגר.'}
            </p>
          </div>
          <div className="card">
            <div className="muted small">תשלומים באיחור</div>
            <div className="serif" style={{
              fontSize: 25, marginTop: 4,
              color: (cash?.overdue_items ?? 0) > 0 ? 'var(--red)' : 'var(--green)',
            }}>
              {cash?.overdue_items ?? 0}
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>
              {(cash?.overdue_items ?? 0) > 0 ? 'שורות תקציב שעבר מועד התשלום שלהן.' : 'אין חריגות.'}
            </p>
          </div>
          <div className="card">
            <div className="muted small">מרחבי אירוע פעילים</div>
            <div className="serif" style={{ fontSize: 25, marginTop: 4 }}>
              {(overdueRes.data ?? []).length}
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>סה״כ אירועים בניהול.</p>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} שע׳ ${minutes % 60} דק׳`;
  return `${Math.floor(hours / 24)} ימים`;
}

function Stat({ v, l, tone }: { v: string; l: string; tone?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 13 }}>
      <div className="serif" style={{ fontSize: 21, color: tone ?? 'inherit', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div className="muted small">{l}</div>
    </div>
  );
}

async function Shell({ brand, children }: { brand: Awaited<ReturnType<typeof getBrand>>; children: React.ReactNode }) {
  return (
    <main style={{ ...brandStyle(brand), maxWidth: 1000, margin: '0 auto', padding: '26px 16px 90px' }}>
      {children}
    </main>
  );
}
