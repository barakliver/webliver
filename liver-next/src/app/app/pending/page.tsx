import { redirect } from 'next/navigation';
import { requireAccount, isLive } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { SignupPath } from '@/components/app/SignupPath';

export async function generateMetadata() {
  return { title: (await serverCopy()).pending.title };
}

/**
 * Where somebody lands who is not let in yet, and what they are asked.
 *
 * The first time, a question: a production business, or somebody making an
 * event of their own - and for the second, which event. Answering is a request
 * and grants nothing; the sentence it leaves behind says who is deciding.
 *
 * An address somebody invited never arrives here at all: the database made it
 * a client at the door and `isLive` is already true.
 */
export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; change?: string }>;
}) {
  const ui = await serverCopy();
  const account = await requireAccount();
  if (isLive(account)) redirect('/app');

  const { step, change } = await searchParams;
  const status = account.producer?.status ?? 'pending';
  const p = ui.pending;

  /* Only an account still waiting may answer. A suspended or declined one has
     been decided about, and the form would be refused by the database anyway;
     not drawing it is the kinder half of that. */
  const mayAnswer = status === 'pending';
  const asking = mayAnswer && (account.intent === null || change === '1');

  return (
    <div className="mx-auto max-w-prose2">
      <PageHead title={asking ? p.ask.title : p.title}
        report={<IssueReporter userId={account.id} context={p.title} />}
      />
      <SignupPath p={p} step={step} change={change} intent={account.intent} status={status} mayAnswer={mayAnswer} />
    </div>
  );
}
