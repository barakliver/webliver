import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { currentLocale, serverCopy } from '@/lib/serverLocale';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LoadTrouble } from '@/components/app/LoadTrouble';
import { CircleFeed } from '@/components/app/CircleFeed';
import { loadFeed, whoAmI } from '@/lib/circle';
import { isCategory, type CircleCategory } from '@/content/critique';

export async function generateMetadata() {
  return { title: (await serverCopy()).circle.title };
}
export const dynamic = 'force-dynamic';

/**
 * The circle of couples around one producer.
 *
 * Which producer is not a choice on this screen: it is where the account
 * already is. A couple's is the producer of their workspace, a producer's
 * is their own, and the reader behind the feed refuses anybody else's.
 */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const account = await requireAccount();
  const locale = await currentLocale();
  const ui = appUiFor(locale);
  const c = ui.circle;
  const sb = await supabaseServer();

  const raw = String((await searchParams).c ?? '');
  const category: CircleCategory | '' = isCategory(raw) ? (raw as CircleCategory) : '';
  const who = await whoAmI(sb, account);
  const posts = who.producerId ? await loadFeed(sb, who.producerId, category) : [];

  return (
    <CopyProvider value={ui}>
      {account.role === 'client' && (
        <Link href="/app/portal" className="btn-quiet mb-4 inline-flex items-center gap-1.5 px-0 text-[14px]">
          <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
          {c.back}
        </Link>
      )}
      <PageHead
        title={c.title}
        sub={account.role === 'client' ? c.sub : c.subProducer}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />
      <LoadTrouble />
      {who.producerId ? (
        <CircleFeed
          producerId={who.producerId} clientId={who.clientId}
          posts={posts} category={category}
          viewer={account.role === 'client' ? 'client' : 'producer'}
        />
      ) : (
        <p className="card text-[15px] text-ink-mute">{c.closed}</p>
      )}
    </CopyProvider>
  );
}
