import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { PageHead } from '@/components/app/PageHead';
import { SiteEditor } from '@/components/app/SiteEditor';
import { EDITABLE, EDITABLE_KEYS, defaultAt } from '@/content/editable';
import { serverCopy } from '@/lib/serverLocale';
import { safeRows } from '@/lib/safe';
import { IssueReporter } from '@/components/app/IssueReporter';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return { title: (await serverCopy()).siteEditor.title };
}

/**
 * The words on the public site.
 *
 * Each field arrives holding what the site currently says: the override if
 * there is one, the shipped wording if there is not. That is what makes the
 * screen honest about the difference between the two, and it is why the reset
 * button can promise something specific.
 */
export default async function SiteEditorPage() {
  const ui = await serverCopy();
  const account = await requireLiveProducer();
  const sb = await supabaseServer();

  const rows = await safeRows<{ key: string; value: string }>('site copy', sb
    .from('site_content')
    .select('key,value'));

  const overridden = new Set(rows.map((r) => r.key).filter((k) => EDITABLE_KEYS.has(k)));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const values: Record<string, string> = {};
  for (const group of EDITABLE) {
    for (const field of group.fields) {
      values[field.key] = byKey.get(field.key) ?? defaultAt(field.key);
    }
  }

  return (
    <>
      <PageHead title={ui.siteEditor.title} sub={ui.siteEditor.sub}
        report={<IssueReporter userId={account.id} context={ui.siteEditor.title} />}
      />
      <SiteEditor values={values} overridden={overridden} />
      <p className="mt-8 text-[13px] text-ink-mute">{ui.siteEditor.note}</p>
    </>
  );
}
