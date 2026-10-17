import type { Metadata } from 'next';
import { requireAccount } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { ProfileForm } from './ProfileForm';
import { IssueReporter } from '@/components/app/IssueReporter';
import { AlertSettings, type AlertPrefs } from '@/components/app/AlertSettings';
import { supabaseServer } from '@/lib/supabase/server';
import { pushConfigured } from '@/lib/notify/push';
import { optional } from '@/lib/env';

export async function generateMetadata() {
  return { title: (await serverCopy()).profile.title };
}

export default async function ProfilePage() {
  const ui = await serverCopy();
  const account = await requireAccount();

  /* The producer's alerts. A couple or a crew member has no enquiries to be
     told about, and the panel is not drawn for them rather than drawn and
     empty. */
  const producer = account.role === 'producer';
  let prefs: AlertPrefs = { whatsapp_number: '', push_enabled: true, quiet_start: null, quiet_end: null };
  let phones = 0;
  if (producer) {
    const sb = await supabaseServer();
    const [{ data: p }, { count }] = await Promise.all([
      sb.from('notification_preferences').select('whatsapp_number,push_enabled,quiet_start,quiet_end').eq('profile_id', account.id).maybeSingle(),
      sb.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('profile_id', account.id).is('gone_at', null),
    ]);
    if (p) prefs = { ...prefs, ...(p as Partial<AlertPrefs>) };
    phones = count ?? 0;
  }

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
      {producer && (
        <div className="mt-6 max-w-3xl">
          <AlertSettings prefs={prefs} phones={phones} publicKey={pushConfigured() ? optional('VAPID_PUBLIC_KEY') : null} />
        </div>
      )}
    </>
  );
}
