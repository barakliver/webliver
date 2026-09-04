import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { PrintButton } from '@/components/app/PrintButton';
import { SopBook } from '@/components/app/SopBook';
import { GuideBookView } from '@/components/app/GuideBook';
import { WorkflowTemplates } from '@/components/app/WorkflowTemplates';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { loadTemplates } from '@/lib/workflow';
import { sopCopy, sopItemCount } from '@/content/sop';
import { producerGuide, clientGuide, guideUi } from '@/content/guide';
import { knowledgeCopy } from '@/content/site';
import { cn } from '@/lib/utils';

export const metadata = { title: knowledgeCopy.title };
export const dynamic = 'force-dynamic';

const SHELVES = ['book', 'playbook', 'templates'] as const;
type Shelf = (typeof SHELVES)[number];
const readShelf = (raw: string | undefined): Shelf =>
  (SHELVES as readonly string[]).includes(raw ?? '') ? (raw as Shelf) : 'book';

/**
 * One place to look things up.
 *
 * There were two, next to each other in the menu, and a producer had no way to
 * tell from their names which one held the answer they wanted. "מדריכים" was
 * how to use this system; "ספר ההפעלה" was how to run an event on open ground.
 * Both are knowledge, neither name says which kind, and the cost of guessing
 * wrong is opening the other one.
 *
 * They are not merged into one document, because they genuinely are different
 * things: one is software help and the other is a professional playbook that
 * would read as alarming to somebody who has never run an event in a field.
 * What is merged is the decision about where to look. One destination, and the
 * kind of knowledge is a filter inside it rather than a second entry in a menu
 * that is already ten items long.
 *
 * The couple keeps its own route. They see one book, it is the only help they
 * have, and sending them through a screen with a producer's playbook behind a
 * tab would be offering them a door they must not open.
 */
export default async function KnowledgePage({
  searchParams,
}: { searchParams: Promise<{ shelf?: string }> }) {
  const account = await requireLiveProducer();
  /* A couple reaching this address has come from an old link. Their book is
     where it always was. */
  if (account.role === 'client') redirect('/app/guide');

  const shelf = readShelf((await searchParams).shelf);
  const sb = await supabaseServer();
  const templates = await loadTemplates(sb);

  const c = knowledgeCopy;
  const counts: Record<Shelf, number> = {
    book: producerGuide.chapters.reduce((n, ch) => n + ch.entries.length, 0),
    playbook: sopItemCount,
    templates: templates.length,
  };

  return (
    <>
      {/* Printing the playbook is a real use of it: it goes in a folder that
          travels to a field with no signal. The rules below are the ones that
          made it print as a document rather than as a screenshot of a screen,
          and they moved here with it. */}
      {/* The one print rule that is this page's alone: a chapter of the
          playbook starts on a fresh sheet, so the folder can be read a
          chapter at a time. Everything else comes from the shared .print-doc
          rules in globals.css. */}
      <style>{`
        @media print {
          .sop-chapter { break-before: page; }
          .sop-chapter:first-child { break-before: auto; }
        }
      `}</style>

      <PageHead
        title={c.title}
        sub={c.sub}
        actions={shelf === 'playbook' ? <PrintButton label={sopCopy.print} /> : undefined}
        report={<IssueReporter userId={account.id} context={`${c.title} · ${c.shelves[shelf]}`} />}
      />

      {/* Links rather than client state, so a shelf is an address somebody can
          send, reopen and come back to — the same reason the event file's own
          sections are links. */}
      <nav aria-label={c.title} className="no-print -mx-5 mb-7 flex gap-1.5 overflow-x-auto border-b border-line px-5 pb-3 sm:mx-0 sm:px-0">
        {SHELVES.map((s) => {
          const on = s === shelf;
          return (
            <Link
              key={s}
              href={s === 'book' ? '/app/knowledge' : `/app/knowledge?shelf=${s}`}
              aria-current={on ? 'page' : undefined}
              scroll={false}
              className={cn(
                'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl2 px-4 text-[14px] transition sm:min-h-[38px]',
                on ? 'bg-ink font-medium text-surface' : 'text-ink-soft hover:bg-surface-200 hover:text-ink',
              )}
            >
              {c.shelves[s]}
              {counts[s] > 0 && (
                <span className={cn(
                  'rounded-xl2 px-1.5 text-[11.5px] tabular-nums',
                  on ? 'bg-card/20 text-surface' : 'bg-surface-200 text-ink-mute',
                )}>
                  {counts[s]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {shelf === 'book' && (
        <>
          <GuideBookView book={producerGuide} c={guideUi} />

          {/* The couple's own book, readable here so a producer can answer a
              question about a screen they cannot see. */}
          <section className="mt-14 border-t border-line pt-9">
            <p className="eyebrow">{clientGuide.title}</p>
            <p className="mb-6 mt-1 max-w-2xl text-[13.5px] text-ink-soft">{guideUi.coupleBookNote}</p>
            <GuideBookView book={clientGuide} c={guideUi} />
          </section>
        </>
      )}

      {shelf === 'playbook' && (
        <div className="print-doc">
          <p className="mb-6 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
            {sopCopy.sub} {sopCopy.itemsCount(sopItemCount)}.
          </p>
          <SopBook />
        </div>
      )}

      {shelf === 'templates' && <WorkflowTemplates templates={templates} />}
    </>
  );
}
