import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { currentLocale } from '@/lib/serverLocale';
import { appUiFor } from '@/content/appUi';
import { CopyProvider } from '@/components/app/CopyProvider';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { LoadTrouble } from '@/components/app/LoadTrouble';
import { Questionnaire } from '@/components/app/Questionnaire';
import { loadPortal } from '@/lib/portal';
import { pickWorkspace } from '@/lib/portalScope';
import { safeRows } from '@/lib/safe';
import { INTAKE_KEY } from '@/content/intake';
import type { Answer } from '@/lib/intake';

export async function generateMetadata() {
  return { title: appUiFor(await currentLocale()).intake.title };
}

export const dynamic = 'force-dynamic';

/**
 * The couple's questionnaire, on its own page.
 *
 * Its own address rather than a drawer on the portal, because it is a
 * twenty minute task somebody does in stages from a phone, and a screen
 * for that is a screen with nothing else on it. The answers arrive
 * through the couple's own policy: a partner's private answers are not
 * in the rows at all.
 */
export default async function QuestionnairePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const account = await requireAccount();
  const locale = await currentLocale();
  const ui = appUiFor(locale);
  const sb = await supabaseServer();
  const data = await loadPortal(sb, { asClient: true });
  const w = pickWorkspace(data.workspaces, (await searchParams).w);
  const answers = w
    ? await safeRows<Answer>('answers', sb.from('questionnaire_responses')
      .select('question_key,answered_by,value,visibility,updated_at').eq('client_id', w.id).eq('form_key', INTAKE_KEY))
    : [];

  return (
    <CopyProvider value={ui}>
      <Link href="/app/portal" className="btn-quiet mb-4 inline-flex items-center gap-1.5 px-0 text-body">
        <ArrowLeft size={16} aria-hidden strokeWidth={1.5} />
        {ui.intake.backToPortal}
      </Link>
      <PageHead title={ui.intake.title} sub={w?.display_name ?? ''}
        report={<IssueReporter userId={account.id} context={ui.intake.title} />} />
      <LoadTrouble />
      {w
        ? <Questionnaire clientId={w.id} viewerId={account.id} answers={answers} locale={locale} />
        : <p className="card text-lead text-ink-mute">{ui.portal.empty}</p>}
    </CopyProvider>
  );
}
