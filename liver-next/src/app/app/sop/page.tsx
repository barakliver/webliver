import { PageHead } from '@/components/app/PageHead';
import { PrintButton } from '@/components/app/PrintButton';
import { SopBook } from '@/components/app/SopBook';
import { requireLiveProducer } from '@/lib/auth';
import { sopCopy, sopItemCount } from '@/content/sop';
import { supabaseServer } from '@/lib/supabase/server';
import { loadTemplates } from '@/lib/workflow';
import { WorkflowTemplates } from '@/components/app/WorkflowTemplates';

export const metadata = { title: sopCopy.title };

/**
 * The production playbook.
 *
 * Producer-only. It is how this business works, not something a couple needs,
 * and half of it would read as alarming to somebody who has never run an event
 * on open ground.
 *
 * No database behind it. It is the same for every event and every producer, it
 * needs no migration to change, and it is reviewable in a diff like any other
 * writing — which means it will actually get corrected when somebody learns
 * something new, instead of waiting for a screen to be built for editing it.
 */
export const dynamic = 'force-dynamic';

export default async function SopPage() {
  await requireLiveProducer();

  /* The playbook is how this business works and never changes per producer;
     the templates are how *this* producer works and are theirs alone. They sit
     on one page because a person looking for either is looking for "the way I
     do things", and splitting that across two screens is a distinction only
     the database cares about. */
  const sb = await supabaseServer();
  const templates = await loadTemplates(sb);

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          body > .sop-print { display: block !important; }
          .no-print { display: none !important; }
          .sop-print { padding: 0; color: #000; background: #fff; }
          .sop-chapter { break-before: page; }
          .sop-chapter:first-child { break-before: auto; }
          .sop-item, .sop-section { break-inside: avoid; }
          @page { margin: 16mm 14mm; }
        }
      `}</style>

      <div className="no-print mb-2 flex flex-wrap items-center justify-end gap-3">
        <PrintButton label={sopCopy.print} />
      </div>

      <div className="no-print mb-8">
        <WorkflowTemplates templates={templates} />
      </div>

      <div className="sop-print">
        <PageHead title={sopCopy.title} sub={`${sopCopy.sub} ${sopCopy.itemsCount(sopItemCount)}.`} />
        <SopBook />
      </div>
    </>
  );
}
