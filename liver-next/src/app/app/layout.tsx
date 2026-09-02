import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { AppShell, type ClientNavLabels } from '@/components/app/AppShell';
import { brandFor } from '@/lib/branding';
import { currentLocale } from '@/lib/serverLocale';
import { appUiFor } from '@/content/appUi';
import { guideUiFor } from '@/content/guide';
import type { Notice } from '@/components/app/NoticeBell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();

  /* the policy already limits this to the signed-in person's own inbox, so
     there is nothing to filter here beyond keeping the list short */
  const sb = await supabaseServer();

  /* Stamped here because this layout wraps every signed-in screen, and the
     function itself refuses to write more than once every twenty hours. That
     is the difference between an activity column and one write per page view.
     Failure is ignored on purpose: nobody's app should fail to open because a
     telemetry column could not be updated. */
  void sb.rpc('touch_seen').then(({ error }) => {
    if (error) console.error('[seen] stamp failed', error);
  });

  const { data } = await sb
    .from('notifications')
    .select('id,kind,title,body,href,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  const brand = await brandFor(account);

  /* The couple's two menu labels, in the couple's language. Reused from the
     screens they name rather than written again: the portal's own title and
     the book's own title, so the menu and the page always agree. */
  let clientNav: ClientNavLabels | undefined;
  if (account.role === 'client') {
    const locale = await currentLocale();
    clientNav = { portal: appUiFor(locale).portal.title, guide: guideUiFor(locale).pageTitle };
  }

  return (
    <AppShell account={account} notices={(data ?? []) as Notice[]} brand={brand} clientNav={clientNav}>
      {children}
      <Live sources={[{ table: 'notifications' }]} />
    </AppShell>
  );
}
