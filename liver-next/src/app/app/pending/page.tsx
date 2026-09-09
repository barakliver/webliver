import { redirect } from 'next/navigation';
import { requireAccount, isLive } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';

export async function generateMetadata() {
  return { title: (await serverCopy()).pending.title };
}

export default async function PendingPage() {
  const ui = await serverCopy();
  const account = await requireAccount();
  if (isLive(account)) redirect('/app');

  const status = account.producer?.status ?? 'pending';

  return (
    <div className="mx-auto max-w-prose2">
      <PageHead title={ui.pending.title}
        report={<IssueReporter userId={account.id} context={ui.pending.title} />}
      />
      <div className="card space-y-4">
        {ui.pending.body.map((line) => (
          <p key={line} className="text-[16px] leading-relaxed text-ink-soft">{line}</p>
        ))}
        <div className="flex items-center gap-2 border-t border-line pt-4 text-[14.5px]">
          <span className="text-ink-mute">{ui.pending.statusLabel}:</span>
          <b className="text-ink">{ui.pending.statuses[status]}</b>
        </div>
      </div>
    </div>
  );
}
