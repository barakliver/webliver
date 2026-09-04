import type { Metadata } from 'next';
import { requireAccount } from '@/lib/auth';
import { currentLocale } from '@/lib/serverLocale';
import { PageHead } from '@/components/app/PageHead';
import { GuideBookView } from '@/components/app/GuideBook';
import { AiConcierge } from '@/components/marketing/AiConcierge';
import { conciergeFor } from '@/content/ui';
import {
  producerGuide, clientGuide, clientGuideFor, guideUi, guideUiFor,
} from '@/content/guide';
import { IssueReporter } from '@/components/app/IssueReporter';
import { ticketFor } from '@/content/appUi';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: guideUiFor(await currentLocale()).pageTitle };
}

/**
 * The operating book, behind the door, for whoever just walked in.
 *
 * One route, two books. A couple gets their own book in their own language. A
 * producer gets the console's book, and under it the couple's book too,
 * because half of a producer's support questions are the couple's questions
 * arriving second hand, and answering them in the book's own words beats
 * paraphrasing from memory.
 *
 * The concierge floats on this page as well: the book answers the questions
 * it thought of, the assistant answers the one it did not, and the assistant
 * has read the book (lib/ai/concierge.ts), so the two give the same answer.
 */
export default async function GuidePage() {
  const account = await requireAccount();
  const isClient = account.role === 'client';

  /* The producer's console is Hebrew; only a couple reads this in English. */
  const locale = isClient ? await currentLocale() : 'he';
  const c = guideUiFor(locale);
  const book = isClient ? clientGuideFor(locale) : producerGuide;

  return (
    <>
      <PageHead title={c.pageTitle} sub={c.pageSub}
        report={<IssueReporter userId={account.id} context={c.pageTitle} copy={ticketFor(locale)} />}
      />

      <GuideBookView book={book} c={c} />

      {!isClient && (
        <section className="mt-14 border-t border-line pt-9">
          <p className="eyebrow">{clientGuide.title}</p>
          <p className="mt-1 mb-6 max-w-2xl text-[13.5px] text-ink-soft">{guideUi.coupleBookNote}</p>
          <GuideBookView book={clientGuide} c={guideUi} />
        </section>
      )}

      <section className="card mt-12 max-w-2xl">
        <h2 className="font-display text-[18px] font-semibold text-ink">{c.askTitle}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{c.askBody}</p>
      </section>

      <AiConcierge copy={conciergeFor(locale)} />
    </>
  );
}
