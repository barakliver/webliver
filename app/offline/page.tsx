export const metadata = { title: 'אין חיבור' };

export default function OfflinePage() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 44 }} aria-hidden>📡</div>
        <h1 className="serif" style={{ fontSize: 24, marginTop: 10 }}>אין חיבור לרשת</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          המסכים שנטענו קודם עדיין זמינים. נתונים חדשים יסתנכרנו כשהחיבור יחזור.
        </p>
      </div>
    </main>
  );
}
