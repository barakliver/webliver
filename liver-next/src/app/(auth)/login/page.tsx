import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/auth';
import { site } from '@/content/site';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'כניסה' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await currentAccount()) redirect('/app');
  const { next } = await searchParams;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center font-display text-[19px] font-semibold text-ink">
          {site.brand}
        </Link>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
