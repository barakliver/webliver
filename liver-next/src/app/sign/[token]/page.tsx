import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { site } from '@/content/site';
import { serverCopy } from '@/lib/serverLocale';
import { CopyProvider } from '@/components/app/CopyProvider';
import { PromiseLine } from '@/components/Promise';
import { Money } from '@/components/Ltr';
import { SignForm } from './SignForm';
import { SignSteps } from './SignSteps';
import { CountUp } from '@/components/guest/CountUp';
import { Petals } from '@/components/guest/Petals';
import { EVENT_ZONE } from '@/lib/clock';

/**
 * An agreement, opened by somebody with no account.
 *
 * A DJ or a caterer is not going to open an account to agree a price, and an
 * agreement that asks them to is an agreement that goes back to WhatsApp. So
 * the token in the URL is the credential, exactly as it is for a guest
 * confirming attendance, and the database function behind it returns the
 * document and who it is for and nothing at all about the wedding it belongs
 * to.
 *
 * Read through the public client, which carries no session. There is nothing
 * here for a session to unlock.
 */

export const dynamic = 'force-dynamic';
/* An agreement is a private document and the link is the credential. Nothing
   about this page belongs in an index or a shared cache. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await serverCopy()).sign.eyebrow,
    robots: { index: false, follow: false, nocache: true },
  };
}

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE,
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

type Agreement = {
  id: string; title: string; body: string; file_path: string | null;
  amount: string | number | null;
  party_name: string; party_role: string;
  status: 'sent' | 'signed';
  signed_at: string | null; signed_name: string | null;
  brand: string;
};

/* One place for the sign, so a page that draws it is not building a price by hand. */
const SHEKEL = '\u20AA';

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ui = await serverCopy();
  const c = ui.sign;

  const sb = supabasePublic();
  const { data } = await sb.rpc('contract_by_token', { p_token: token });
  const deal = (Array.isArray(data) ? data[0] : null) as Agreement | null;

  return (
    <CopyProvider value={ui}>
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-2xl">
        <p className="text-center font-display text-subhead font-normal text-ink">
          {deal?.brand || site.brand}
        </p>
        <PromiseLine className="mb-7 mt-2" />

        {!deal ? (
          /* One answer to every wrong token: a link that no longer works. A
             page that distinguished "signed already" from "never existed"
             would confirm a guess to whoever was guessing. */
          <div className="card text-center">
            <h1 className="font-display text-title font-light text-ink">{c.badLink}</h1>
            <p className="mt-3 text-lead leading-relaxed text-ink-soft">{c.badLinkBody}</p>
          </div>
        ) : (
          <>
            <SignSteps signed={deal.status === 'signed'} />
            {/* The agreement's head is a band: what it is, who it is with, and
                the amount as the one number on it, counted up when the page
                opens. The terms are the paper under it. */}
            <header className="band-dark mt-5 overflow-hidden rounded-panel px-6 py-7 text-center sm:px-8">
              <p className="eyebrow text-accent-light">{c.eyebrow}</p>
              <h1 className="animate-rise mt-2 font-display text-title font-light">{deal.title}</h1>
              {(deal.party_name || deal.party_role) && (
                <p className="mt-1.5 text-body text-accent-light">
                  {[deal.party_name, deal.party_role].filter(Boolean).join(' · ')}
                </p>
              )}
              {deal.amount !== null && (
                <p className="mt-5 flex items-end justify-center gap-2 text-accent-light">
                  <span className="pb-1.5 text-body">{c.amount}</span>
                  <span className="font-display text-[44px] font-light leading-none">
                    {Number.isInteger(Number(deal.amount))
                      ? <CountUp n={Number(deal.amount)} prefix={SHEKEL} />
                      : <Money value={Number(deal.amount)} />}
                  </span>
                </p>
              )}
            </header>

            <article id="terms" className="card mt-5">

              {/* The terms as they were written, line breaks and all. This is
                  the text the fingerprint is taken of, so what is shown here is
                  exactly what is being agreed to. */}
              <p className="whitespace-pre-line text-lead leading-[1.9] text-ink">
                {deal.body}
              </p>
            </article>

            {deal.status === 'signed' ? (
              <div className="panel relative mt-5 overflow-hidden text-center">
                <Petals />
                <div aria-hidden className="pop-in mx-auto mb-3 grid size-14 place-items-center rounded-full bg-tone-rubine text-tone-rubine-on">
                  <svg className="draw-check" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                </div>
                <p className="eyebrow text-ok">{c.doneTitle}</p>
                <p className="mt-2 text-lead text-ink">
                  {c.doneBy} {deal.signed_name}
                </p>
                {deal.signed_at && (
                  <p className="mt-1 text-body text-ink-soft">
                    {c.doneAt}{' '}
                    <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>
                      {dateFmt.format(new Date(deal.signed_at))}
                    </span>
                  </p>
                )}
                <p className="mt-3 text-body leading-relaxed text-ink-mute">{c.doneBody}</p>
              </div>
            ) : (
              <SignForm token={token} defaultName={deal.party_name} />
            )}
          </>
        )}
      </div>
    </main>
    </CopyProvider>
  );
}
