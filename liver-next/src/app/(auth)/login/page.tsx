import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/auth';
import { site } from '@/content/site';
import { PromiseLine } from '@/components/Promise';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'כניסה' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; reason?: string }>;
}) {
  if (await currentAccount()) redirect('/app');
  const { next, email, reason } = await searchParams;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        {/* The name, and nothing else. A portrait sat here on the argument that
            signing in is the moment somebody hands something over and should
            see who to. In practice it pushed the card down the screen, put a
            face where a person is trying to find a field, and on a phone the
            input landed under the keyboard. The wordmark carries the same
            reassurance in a tenth of the height. */}
        <Link href="/" className="mb-7 block text-center">
          <span className="font-display text-[21px] font-light text-ink">{site.brand}</span>
          <span className="mt-1 block text-[13.5px] text-ink-mute">{site.tagline}</span>
        </Link>
        {/* Signing in is the first screen a couple sees that is not the
            marketing site. The line is what tells them they are still in the
            same place. */}
        <PromiseLine className="mb-7" />
        <LoginForm next={next} prefill={email} reason={reason} />
      </div>
    </main>
  );
}
