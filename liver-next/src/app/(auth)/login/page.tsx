import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/auth';
import { site } from '@/content/site';
import { Portrait } from '@/components/marketing/Portrait';
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
        {/* Signing in is the moment a couple is handing something over.
            Showing who they are handing it to belongs here as much as on the
            front page. */}
        <Link href="/" className="mb-6 flex flex-col items-center gap-3">
          <Portrait
            avatar
            priority
            sizes="96px"
            className="h-24 w-24 rounded-full object-cover shadow-soft ring-1 ring-white/70"
          />
          <span className="font-display text-[19px] font-semibold text-ink">{site.brand}</span>
        </Link>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
