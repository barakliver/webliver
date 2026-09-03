import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/auth';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { brandForHost } from '@/lib/branding';
import { authFor, privacyFor, termsFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { PromiseLine } from '@/components/Promise';
import { LoginForm } from './LoginForm';
import { HashSession } from './HashSession';

/* A door, not a destination. Indexing it means somebody searching for a
   wedding producer can land on a sign-in form for an account they do not
   have, which answers no question they asked. */
export async function generateMetadata(): Promise<Metadata> {
  const a = authFor(await currentLocale());
  /* The card a shared link draws. Every producer on the platform sends this
     door to their couples, and every signed-in route redirects a stranger -
     including WhatsApp's scraper - to it. Inherited from the root it carried
     the platform owner's name and photograph, which on a white label is
     the one thing a producer's couple must never receive. So the door is
     neutral: what it is, no whose. `absolute` keeps the root's "| brand"
     template off the title as well. */
  return {
    title: { absolute: a.title },
    description: a.sub,
    robots: { index: false, follow: true },
    openGraph: { type: 'website', title: a.title, description: a.sub },
    twitter: { card: 'summary', title: a.title, description: a.sub },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; reason?: string; ref?: string }>;
}) {
  if (await currentAccount()) redirect('/app');
  const { next, email, reason, ref } = await searchParams;

  const locale = await currentLocale();
  const site = await getSiteCopy(supabasePublic(), locale);
  /* Whose door this is. On a tenant's domain the wordmark is the tenant's,
     and the platform's promise line stays home: it is one producer's
     signature, not a fixture of the sign-in screen. */
  const host = await brandForHost();

  /* Extra room at the foot rather than symmetric padding. The accessibility
     button is fixed about 5.5rem up from the bottom on the start edge, and on a
     short viewport the card's last line, which is the sentence linking the
     terms and the privacy policy, lands underneath it. Visible in both
     languages once you look; it simply moves from one corner to the other with
     the direction. */
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 pb-36 pt-16">
      <div className="w-full max-w-md">
        {/* The name, and nothing else. A portrait sat here on the argument that
            signing in is the moment somebody hands something over and should
            see who to. In practice it pushed the card down the screen, put a
            face where a person is trying to find a field, and on a phone the
            input landed under the keyboard. The wordmark carries the same
            reassurance in a tenth of the height. */}
        <Link href="/" className="mb-7 block text-center">
          <span className="font-display text-[21px] font-light text-ink">{host.isPlatform ? site.brand : host.name}</span>
          <span className="mt-1 block text-[13.5px] text-ink-mute">{host.isPlatform ? site.tagline : host.tagline}</span>
        </Link>
        {/* Signing in is the first screen a couple sees that is not the
            marketing site. The line is what tells them they are still in the
            same place. */}
        {host.isPlatform && <PromiseLine className="mb-7" text={site.hero.headline} />}
        {/* A link that handed the session back in the fragment lands here
            with the credential still in the address bar. This picks it up
            rather than letting it go to waste. */}
        <HashSession next={next ?? '/app'} />
        <LoginForm
          next={next} prefill={email} reason={reason} referral={ref}
          copy={authFor(locale)}
          legal={{ privacy: privacyFor(locale), terms: termsFor(locale) }}
        />
      </div>
    </main>
  );
}
