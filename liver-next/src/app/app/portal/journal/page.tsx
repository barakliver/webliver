import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { currentLocale } from '@/lib/serverLocale';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LoadTrouble } from '@/components/app/LoadTrouble';
import { JournalBook } from '@/components/app/JournalBook';
import { loadJournal, whoAmI } from '@/lib/circle';
import { serverCopy } from '@/lib/serverLocale';

export async function generateMetadata() {
  return { title: (await serverCopy()).journal.title };
}
export const dynamic = 'force-dynamic';

/**
 * The couple's own notebook of other people's weddings.
 *
 * Theirs and their producer's, which is the same gate every other row on
 * a workspace uses. A producer arriving here without an event named in the
 * address is looking at nothing in particular, so they are sent to the
 * event they wanted instead.
 */
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const account = await requireAccount();
  const locale = await currentLocale();
  const ui = appUiFor(locale);
  const c = ui.journal;
  const sb = await supabaseServer();

  const wanted = (await searchParams).c;
  const who = await whoAmI(sb, account, wanted);
  /* A producer reads one event's journal from the event's own address. */
  const clientId = who.clientId ?? (wanted ?? '');
  const logs = clientId ? await loadJournal(sb, clientId) : [];

  return (
    <CopyProvider value={ui}>
      <Link href={account.role === 'client' ? '/app/portal' : `/app/clients/${clientId}`} className="btn-quiet mb-4 inline-flex items-center gap-1.5 px-0 text-[14px]">
        <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
        {c.back}
      </Link>
      <PageHead
        title={c.title}
        sub={account.role === 'client' ? c.sub : c.subProducer}
        report={<IssueReporter userId={account.id} context={c.title} />}
      />
      <LoadTrouble />
      {clientId
        ? <JournalBook clientId={clientId} logs={logs} viewer={account.role === 'client' ? 'client' : 'producer'} />
        : <p className="card text-[15px] text-ink-mute">{c.noneProducer}</p>}
    </CopyProvider>
  );
}
