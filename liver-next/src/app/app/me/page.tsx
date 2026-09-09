import type { Metadata } from 'next';
import { requireAccount } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { ProfileForm } from './ProfileForm';
import { IssueReporter } from '@/components/app/IssueReporter';

export async function generateMetadata() {
  return { title: (await serverCopy()).profile.title };
}

export default async function ProfilePage() {
  const ui = await serverCopy();
  const account = await requireAccount();
  return (
    <>
      <PageHead title={ui.profile.title} sub={ui.profile.sub}
        report={<IssueReporter userId={account.id} context={ui.profile.title} />}
      />
      <div className="card max-w-3xl">
        <ProfileForm
          userId={account.id}
          name={account.fullName}
          email={account.email}
          avatarUrl={account.avatarUrl}
        />
      </div>
    </>
  );
}
