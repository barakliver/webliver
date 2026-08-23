import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { getBrand, brandStyle } from '@/lib/tenant';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next && next.startsWith('/') ? next : '/dashboard');

  const brand = await getBrand();

  return (
    <main style={{ ...brandStyle(brand), display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <header style={{ textAlign: 'center', marginBottom: 22 }}>
          <h1 className="serif" style={{ fontSize: 28 }}>{brand.brand_name}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>הזינו את פרטי הכניסה שקיבלתם</p>
        </header>
        <LoginForm next={next && next.startsWith('/') ? next : '/dashboard'} />
      </div>
    </main>
  );
}
