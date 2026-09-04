import { redirect } from 'next/navigation';
import { requireAccount, isLive } from '@/lib/auth';
import { appCopy } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';

export const metadata = { title: appCopy.pending.title };

export default async function PendingPage() {
  const account = await requireAccount();
  if (isLive(account)) redirect('/app');

  const status = account.producer?.status ?? 'pending';

  return (
    <div className="mx-auto max-w-prose2">
      <PageHead title={appCopy.pending.title}
        report={<IssueReporter userId={account.id} context={appCopy.pending.title} />}
      />
      <div className="card space-y-4">
        {appCopy.pending.body.map((line) => (
          <p key={line} className="text-[16px] leading-relaxed text-ink-soft">{line}</p>
        ))}
        <div className="flex items-center gap-2 border-t border-line pt-4 text-[14.5px]">
          <span className="text-ink-mute">{appCopy.pending.statusLabel}:</span>
          <b className="text-ink">{appCopy.pending.statuses[status]}</b>
        </div>
      </div>
    </div>
  );
}
