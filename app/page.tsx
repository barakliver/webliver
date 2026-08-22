import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 20px' }}>
      <h1 className="serif" style={{ fontSize: 32 }}>
        LIver <span style={{ color: 'var(--gold)' }}>Productions</span>
      </h1>
      <p className="muted" style={{ marginTop: 8 }}>
        חבילת הכלים של מרחב הלקוח. פתחו מרחב עבודה בכתובת <code>/workspace/[clientId]</code>.
      </p>
      <p className="muted small" style={{ marginTop: 18 }}>
        <Link href="/">חזרה</Link>
      </p>
    </main>
  );
}
