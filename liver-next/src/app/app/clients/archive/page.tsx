import Link from 'next/link';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead, Empty } from '@/components/app/PageHead';
import { loadShelf } from '@/lib/archive';
import { ArchiveShelf } from '@/components/app/ArchiveShelf';
import { archiveCopy as c } from '@/content/site';
import { IssueReporter } from '@/components/app/IssueReporter';

export const dynamic = 'force-dynamic';
export const metadata = { title: c.title };

/**
 * Closed events, on a shelf, by year.
 *
 * The question this page exists to answer is asked two summers later: "who was
 * the photographer on that wedding in 2025". Which is why the year is the
 * organising idea rather than a filter — somebody arriving here is looking for
 * a season, not for a name they can already remember.
 *
 * Everything on it is frozen. The live rows for these events are still there
 * and still readable; what is shown here is the snapshot taken on the night,
 * which is the version that answers the question correctly after a supplier's
 * row has been renamed twice.
 */
export default async function ArchivePage() {
  const account = await requireLiveProducer();
  const sb = await supabaseServer();
  const shelf = await loadShelf(sb);

  return (
    <>
      <div className="mb-4">
        <Link href="/app/clients" className="btn-quiet inline-block px-0 text-[14px]">
          ← {c.backToLive}
        </Link>
      </div>

      <PageHead title={c.title} sub={c.sub}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />

      {shelf.length === 0
        ? <Empty text={c.empty} />
        : <ArchiveShelf shelf={shelf} />}
    </>
  );
}
