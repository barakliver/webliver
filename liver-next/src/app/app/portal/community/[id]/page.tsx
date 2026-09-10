import { notFound } from 'next/navigation';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { currentLocale, serverCopy } from '@/lib/serverLocale';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { LoadTrouble } from '@/components/app/LoadTrouble';
import { CircleThread } from '@/components/app/CircleThread';
import { loadFeed, loadThread, whoAmI } from '@/lib/circle';

export async function generateMetadata() {
  return { title: (await serverCopy()).circle.title };
}
export const dynamic = 'force-dynamic';

/** One question and its answers. The post is taken from the same reader
 *  the feed uses, so a post outside this account's circle is simply not
 *  there rather than being fetched and then hidden. */
export default async function CirclePostPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAccount();
  const locale = await currentLocale();
  const ui = appUiFor(locale);
  const sb = await supabaseServer();
  const { id } = await params;

  const who = await whoAmI(sb, account);
  if (!who.producerId) notFound();
  const posts = await loadFeed(sb, who.producerId, '');
  const post = posts.find((p) => p.id === id);
  if (!post) notFound();
  const replies = await loadThread(sb, id);

  return (
    <CopyProvider value={ui}>
      <LoadTrouble />
      <CircleThread
        post={post} replies={replies} clientId={who.clientId}
        viewer={account.role === 'client' ? 'client' : 'producer'}
      />
    </CopyProvider>
  );
}
