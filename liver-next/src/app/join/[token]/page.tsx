import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { supabaseServer } from '@/lib/supabase/server';
import { site } from '@/content/site';
import { joinFor, authFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { PromiseLine } from '@/components/Promise';
import { GoogleButton } from '@/app/(auth)/login/GoogleButton';
import { JoinForm } from './JoinForm';

/**
 * The page a printed code opens.
 *
 * It lives on the app host, which is where the QR points, because that is the
 * only host a session exists on: signed in with Google the form arrives with
 * the name filled in and the address fixed, and signed out there is a Google
 * button and a form for those who would rather type. Either way what the page
 * gets from the visitor is a name, a phone, an address and two separate ticks,
 * and what it gives back is a way in.
 *
 * A closed code, an ended conference, a full one and a mistyped address all
 * read the same, so the page cannot be used to ask which codes exist.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: joinFor(await currentLocale()).eyebrow,
    robots: { index: false, follow: false, nocache: true },
  };
}

type Open = { id: string; name: string; kind: 'producer' | 'dj' };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await currentLocale();
  const c = joinFor(locale);
  const auth = authFor(locale);

  const { data } = await supabasePublic().rpc('campaign_open', { p_token: token });
  const campaign = (Array.isArray(data) ? data[0] : null) as Open | null;

  /* Who is looking, if anybody. A visitor with no session is the common case
     and not a failure. */
  const sb = await supabaseServer();
  const { data: who } = await sb.auth.getUser();
  const user = who.user;
  const { data: prof } = user
    ? await sb.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle()
    : { data: null };
  const profile = prof as { full_name: string | null; email: string } | null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <p className="text-center font-display text-subhead font-normal text-ink">{site.brand}</p>
        <PromiseLine className="mb-7 mt-2" />

        {!campaign ? (
          <div className="card text-center">
            <h1 className="font-display text-title font-light text-ink">{c.badLink}</h1>
            <p className="mt-3 text-lead leading-relaxed text-ink-soft">{c.badLinkBody}</p>
          </div>
        ) : (
          <>
            <header className="band-dark animate-rise mb-5 rounded-panel px-6 py-7 text-center">
              <p className="eyebrow text-accent-light">{campaign.name}</p>
              <h1 className="mt-2 font-display text-title font-light">{c.hello}</h1>
              <p className="mt-2 text-body leading-relaxed text-accent-light">{c.forKind[campaign.kind]}</p>
            </header>

            {profile ? (
              <JoinForm
                token={token} copy={c} auth={auth} mode="account"
                defaultName={profile.full_name ?? ''} fixedEmail={profile.email}
              />
            ) : (
              <div className="space-y-5">
                <div>
                  <GoogleButton copy={auth} next={`/join/${token}`} />
                  <p className="mt-2 text-center text-meta text-ink-mute">{c.googleNote}</p>
                </div>
                <p className="eyebrow text-center">{c.or}</p>
                <JoinForm token={token} copy={c} auth={auth} mode="details" />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
