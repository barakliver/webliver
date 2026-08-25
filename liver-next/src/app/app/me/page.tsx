import type { Metadata } from 'next';
import { requireAccount } from '@/lib/auth';
import { appCopy } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';
import { ProfileForm } from './ProfileForm';

export const metadata: Metadata = { title: appCopy.profile.title };

export default async function ProfilePage() {
  const account = await requireAccount();
  return (
    <>
      <PageHead title={appCopy.profile.title} sub={appCopy.profile.sub} />
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
