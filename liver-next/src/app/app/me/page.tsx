import type { Metadata } from 'next';
import { requireAccount } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { Avatar } from '@/components/app/Avatar';
import { DisplayChoice } from '@/components/app/DisplayChoice';
import { signOut } from '@/app/actions/auth';
import { LogOut } from 'lucide-react';
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

  const sec = ui.profile.sections;
  const railLink = 'flex min-h-[40px] items-center gap-2.5 rounded-control px-3 text-body text-ink-soft transition hover:bg-surface-200 hover:text-ink';

  return (
    <>
      <PageHead title={ui.profile.title} sub={ui.profile.sub}
        report={<IssueReporter userId={account.id} context={ui.profile.title} />}
      />

      {/* Who this is, on a swatch of the tamarind: the picture, the name and
          the address the account is keyed on, which is the one thing here that
          cannot be edited and the thing most worth being shown. */}
      <div className="mb-8 flex items-center gap-4 rounded-card bg-tone-tamarind p-5 text-tone-tamarind-on sm:p-6">
        <Avatar name={account.fullName || account.email} src={account.avatarUrl} size={64} />
        <div className="min-w-0">
          <p className="truncate font-display text-panel font-light">{account.fullName || account.email}</p>
          <p className="mt-0.5 truncate text-body text-tone-tamarind-on/90" dir="ltr">{account.email}</p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        {/* The parts of the screen, beside it from a laptop up. Anchors, and a
            way out at the foot of them, because signing out is something a
            profile is where one looks for. */}
        <nav aria-label={ui.profile.title} className="sticky top-24 hidden self-start lg:block">
          <ul className="list-none space-y-0.5 p-0">
            <li><a href="#details" className={railLink}><span aria-hidden className="size-2 rounded-full bg-tone-rubine" />{sec.details}</a></li>
            {producer && <li><a href="#alerts" className={railLink}><span aria-hidden className="size-2 rounded-full bg-tone-boho" />{sec.alerts}</a></li>}
            <li><a href="#display" className={railLink}><span aria-hidden className="size-2 rounded-full bg-tone-camel" />{sec.display}</a></li>
            <li>
              <form action={signOut}>
                <button type="submit" className={`${railLink} w-full`}>
                  <LogOut size={14} strokeWidth={1.5} aria-hidden />{sec.exit}
                </button>
              </form>
            </li>
          </ul>
        </nav>

        <div className="max-w-3xl space-y-6">
          <div id="details" className="card scroll-mt-28">
            <ProfileForm
              userId={account.id}
              name={account.fullName}
              email={account.email}
              avatarUrl={account.avatarUrl}
            />
          </div>
          {producer && (
            <div id="alerts" className="scroll-mt-28">
              <AlertSettings prefs={prefs} phones={phones} publicKey={pushConfigured() ? optional('VAPID_PUBLIC_KEY') : null} />
            </div>
          )}
          <div id="display" className="scroll-mt-28"><DisplayChoice /></div>
        </div>
      </div>
    </>
  );
}
