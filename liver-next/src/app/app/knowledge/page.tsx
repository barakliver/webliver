import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { PrintButton } from '@/components/app/PrintButton';
import { SopBook } from '@/components/app/SopBook';
import { GuideBookView } from '@/components/app/GuideBook';
import { WorkflowTemplates } from '@/components/app/WorkflowTemplates';
import { MeetingTemplates } from '@/components/app/MeetingTemplates';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { loadTemplates } from '@/lib/workflow';
import { loadMeetingTemplates } from '@/lib/meetingTemplateRows';
import { sopCopy, sopItemCount } from '@/content/sop';
import { producerGuide, clientGuide, guideUi } from '@/content/guide';
import { serverCopy } from '@/lib/serverLocale';
import { cn } from '@/lib/utils';

export async function generateMetadata() {
  return { title: (await serverCopy()).knowledge.title };
}
export const dynamic = 'force-dynamic';

const SHELVES = ['book', 'playbook', 'templates'] as const;
type Shelf = (typeof SHELVES)[number];
/* One tone to a shelf. Written out in full: Tailwind reads class names as
   text. `soft` is the on-colour at 90%, which is what clears 4.5 on the boho. */
const SHELF_TONE: Record<Shelf, { box: string; soft: string }> = {
  book:      { box: 'bg-tone-rubine text-tone-rubine-on',     soft: 'text-tone-rubine-on/90' },
  playbook:  { box: 'bg-tone-boho text-tone-boho-on',         soft: 'text-tone-boho-on/90' },
  templates: { box: 'bg-tone-tamarind text-tone-tamarind-on', soft: 'text-tone-tamarind-on/90' },
};
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
  const [templates, meetingTemplates] = await Promise.all([loadTemplates(sb), loadMeetingTemplates(sb)]);

  const ui = await serverCopy();
  const c = ui.knowledge;
  const counts: Record<Shelf, number> = {
    book: producerGuide.chapters.reduce((n, ch) => n + ch.entries.length, 0),
    playbook: sopItemCount,
    templates: templates.length + meetingTemplates.filter((t) => !t.archived).length,
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

      {/* The three shelves as three swatches of the card's colours, each with
          what is inside it, so a shelf is chosen from its contents and not only
          from its name. Still links rather than client state, so a shelf is an
          address somebody can send, reopen and come back to - the same reason
          the event file's own sections are links. The open one is ringed and
          the others are not dimmed, because three colours that fade when they
          are not chosen read as disabled. */}
      <nav aria-label={c.title} className="no-print mb-8 grid gap-3 sm:grid-cols-3">
        {SHELVES.map((s) => {
          const on = s === shelf;
          const tone = SHELF_TONE[s];
          return (
            <Link
              key={s}
              href={s === 'book' ? '/app/knowledge' : `/app/knowledge?shelf=${s}`}
              aria-current={on ? 'page' : undefined}
              scroll={false}
              className={cn(
                'flex min-h-[112px] flex-col justify-between gap-4 rounded-card p-5 transition-transform duration-touch hover:-translate-y-0.5',
                tone.box,
                on && 'outline outline-2 outline-offset-2 outline-ink',
              )}
            >
              <span className={cn('text-meta tabular-nums', tone.soft)}>
                {counts[s] > 0 ? counts[s] : ''}
              </span>
              <span>
                <span className="block font-display text-subhead font-light">{c.shelves[s]}</span>
                <span className={cn('mt-1 block text-body', tone.soft)}>{c.shelfSubs[s]}</span>
              </span>
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
            <p className="mb-6 mt-1 max-w-2xl text-body text-ink-soft">{guideUi.coupleBookNote}</p>
            <GuideBookView book={clientGuide} c={guideUi} />
          </section>
        </>
      )}

      {shelf === 'playbook' && (
        <div className="print-doc">
          <p className="mb-6 max-w-2xl text-body leading-relaxed text-ink-soft">
            {sopCopy.sub} {sopCopy.itemsCount(sopItemCount)}.
          </p>
          <SopBook />
        </div>
      )}

      {shelf === 'templates' && (
        <div className="space-y-8">
          <WorkflowTemplates templates={templates} />
          <div id="meetings"><MeetingTemplates c={ui.meetingTemplates} own={meetingTemplates} /></div>
        </div>
      )}
    </>
  );
}
