import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { currentLocale } from '@/lib/serverLocale';
import { shippedCopy } from '@/lib/siteCopy';
import { site } from '@/content/site';
import { PromiseLine } from '@/components/Promise';

/**
 * Stopping, in one press and with no account.
 *
 * Nothing is asked and nothing is confirmed. A page that said "are you sure"
 * to somebody who has already decided is a page that produces a complaint
 * rather than an unsubscribe, and section 30א gives them a cheaper way to
 * make their point than pressing twice. The link is the whole credential,
 * the same way it is for a guest confirming attendance and a supplier
 * signing.
 *
 * It says the same thing whatever happened. The database returns true for a
 * token it never found, deliberately: a truthful answer here would turn this
 * page into a way of asking whether an address is on the list.
 *
 * A GET that changes something is normally wrong, and this is the exception
 * every mail client depends on — the link in the footer has to work from the
 * footer. What it changes is one flag in one direction, nothing is destroyed,
 * and the record that consent was once given is deliberately left standing.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: shippedCopy(await currentLocale()).unsubscribe.title,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  /* Shipped copy rather than the edited copy. This page is reached from an
     email by somebody who wants out, and it must not wait on a database
     round trip to say so. */
  const c = shippedCopy(await currentLocale()).unsubscribe;

  const sb = supabasePublic();
  /* The one call. A failure is not reported to the reader either, because
     there is nothing for them to do about it and the honest next step is in
     the sentence below, which names a person to write to. */
  const { error } = await sb.rpc('lead_unsubscribe', { p_token: token });
  if (error) console.error('[unsubscribe] refused', { code: error.code, message: error.message });

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-lg">
        <p className="text-center head-panel">{site.brand}</p>
        <PromiseLine className="mb-7 mt-2" />
        <div className="card text-center">
          <h1 className="head-section">{c.title}</h1>
          <p className="mt-3 text-lead leading-relaxed text-ink-soft">{c.body}</p>
          <p className="mt-4 text-body text-ink-mute">{c.note}</p>
        </div>
      </div>
    </main>
  );
}
