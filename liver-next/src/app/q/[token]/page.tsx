import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { site } from '@/content/site';
import { quoteFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { PromiseLine } from '@/components/Promise';
import { Money } from '@/components/Ltr';
import { CountUp } from '@/components/guest/CountUp';
import { Petals } from '@/components/guest/Petals';
import { EVENT_ZONE, todayInZone } from '@/lib/clock';
import { isPayable, safeUrl } from '@/lib/quote';
import { QuoteWays } from './QuoteWays';

/**
 * A price, opened by somebody with no account.
 *
 * The same shape as the signing link and for the same reason: a couple who has
 * just enquired is not going to make an account to read a number, so the token
 * in the address is the credential and the function behind it returns the
 * quote and nothing about the enquiry it came from. A token nobody minted, a
 * withdrawn quote and a mistyped address all answer the same way.
 *
 * Read through the public client, which carries no session.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: quoteFor(await currentLocale()).page.eyebrow,
    robots: { index: false, follow: false, nocache: true },
  };
}

type Quote = {
  title: string; note: string; amount: string | number; valid_until: string | null; status: string;
  choice: string | null; pay_link: string; bank_text: string; to_name: string; brand: string;
};

const SHEKEL = '\u20AA';

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await currentLocale();
  const c = quoteFor(locale).page;

  const sb = supabasePublic();
  const { data } = await sb.rpc('price_quote_by_token', { p_token: token });
  const q = (Array.isArray(data) ? data[0] : null) as Quote | null;
  if (q) await sb.rpc('price_quote_opened', { p_token: token });

  const amount = q ? Number(q.amount) : 0;
  const payable = q ? isPayable({ status: q.status, valid_until: q.valid_until }, todayInZone()) : false;
  const until = q?.valid_until
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
        timeZone: EVENT_ZONE, day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date(`${q.valid_until}T12:00:00Z`))
    : null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-2xl">
        <p className="text-center font-display text-subhead font-normal text-ink">{q?.brand || site.brand}</p>
        <PromiseLine className="mb-7 mt-2" />

        {!q ? (
          <div className="card text-center">
            <h1 className="font-display text-title font-light text-ink">{c.badLink}</h1>
            <p className="mt-3 text-lead leading-relaxed text-ink-soft">{c.badLinkBody}</p>
          </div>
        ) : (
          <>
            <header className="band-dark overflow-hidden rounded-panel px-6 py-7 text-center sm:px-8">
              <p className="eyebrow text-accent-light">{c.eyebrow}</p>
              <h1 className="animate-rise mt-2 font-display text-title font-light">{q.title}</h1>
              {q.to_name && <p className="mt-1.5 text-body text-accent-light">{c.for} {q.to_name}</p>}
              <p className="mt-5 flex items-end justify-center gap-2 text-accent-light">
                <span className="pb-1.5 text-body">{c.amount}</span>
                <span className="font-display text-[44px] font-light leading-none">
                  {Number.isInteger(amount)
                    ? <CountUp n={amount} prefix={SHEKEL} />
                    : <Money value={amount} />}
                </span>
              </p>
              {until && (
                <p className="mt-3 text-body text-accent-light">
                  {c.validUntil} <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>{until}</span>
                </p>
              )}
            </header>

            {q.note && (
              <article className="card mt-5">
                <p className="whitespace-pre-line text-lead leading-[1.9] text-ink">{q.note}</p>
              </article>
            )}

            {q.status === 'paid' ? (
              <div className="panel relative mt-5 overflow-hidden text-center">
                <Petals />
                <div aria-hidden className="pop-in mx-auto mb-3 grid size-14 place-items-center rounded-full bg-tone-rubine text-tone-rubine-on">
                  <svg className="draw-check" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                </div>
                <p className="eyebrow text-ok">{c.paidTitle}</p>
                <p className="mt-3 text-body leading-relaxed text-ink-mute">{c.paidBody}</p>
              </div>
            ) : !payable ? (
              <div className="card mt-5 text-center">
                <h2 className="head-section">{c.expiredTitle}</h2>
                <p className="mt-2 text-body text-ink-soft">{c.expiredBody}</p>
              </div>
            ) : (
              <QuoteWays
                token={token} copy={c} choice={q.choice}
                payLink={safeUrl(q.pay_link)} bankText={q.bank_text}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
