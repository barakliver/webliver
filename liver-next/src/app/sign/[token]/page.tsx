import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { site, signCopy as c } from '@/content/site';
import { PromiseLine } from '@/components/Promise';
import { Money } from '@/components/Ltr';
import { SignForm } from './SignForm';

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
export const metadata: Metadata = {
  title: c.eyebrow,
  robots: { index: false, follow: false, nocache: true },
};

const dateFmt = new Intl.DateTimeFormat('he-IL', {
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

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const sb = supabasePublic();
  const { data } = await sb.rpc('contract_by_token', { p_token: token });
  const deal = (Array.isArray(data) ? data[0] : null) as Agreement | null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-2xl">
        <p className="text-center font-display text-[19px] font-semibold text-ink">
          {deal?.brand || site.brand}
        </p>
        <PromiseLine className="mb-7 mt-2" />

        {!deal ? (
          /* One answer to every wrong token: a link that no longer works. A
             page that distinguished "signed already" from "never existed"
             would confirm a guess to whoever was guessing. */
          <div className="card text-center">
            <h1 className="font-display text-title font-semibold text-ink">{c.badLink}</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{c.badLinkBody}</p>
          </div>
        ) : (
          <>
            <header className="mb-5 text-center">
              <p className="eyebrow">{c.eyebrow}</p>
              <h1 className="mt-2 font-display text-title font-semibold text-ink">{deal.title}</h1>
              {(deal.party_name || deal.party_role) && (
                <p className="mt-1.5 text-[14.5px] text-ink-soft">
                  {[deal.party_name, deal.party_role].filter(Boolean).join(' · ')}
                </p>
              )}
            </header>

            <article className="card">
              {deal.amount !== null && (
                <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
                  <span className="text-[14px] text-ink-soft">{c.amount}</span>
                  <span className="font-display text-[24px] font-semibold tabular-nums text-ink">
                    <Money value={Number(deal.amount)} />
                  </span>
                </div>
              )}

              {/* The terms as they were written, line breaks and all. This is
                  the text the fingerprint is taken of, so what is shown here is
                  exactly what is being agreed to. */}
              <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.9] text-ink">
                {deal.body}
              </p>
            </article>

            {deal.status === 'signed' ? (
              <div className="panel mt-5 text-center">
                <p className="eyebrow text-ok">{c.doneTitle}</p>
                <p className="mt-2 text-[15.5px] text-ink">
                  {c.doneBy} {deal.signed_name}
                </p>
                {deal.signed_at && (
                  <p className="mt-1 text-[14px] text-ink-soft">
                    {c.doneAt}{' '}
                    <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>
                      {dateFmt.format(new Date(deal.signed_at))}
                    </span>
                  </p>
                )}
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-mute">{c.doneBody}</p>
              </div>
            ) : (
              <SignForm token={token} defaultName={deal.party_name} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
