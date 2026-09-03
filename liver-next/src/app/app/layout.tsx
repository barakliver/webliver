import type { Metadata, Viewport } from 'next';
import { requireAccount, currentAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { AppShell, type ClientNavLabels } from '@/components/app/AppShell';
import { brandFor } from '@/lib/branding';
import { PAGE_GROUND } from '@/content/brand';
import { currentLocale } from '@/lib/serverLocale';
import { appUiFor } from '@/content/appUi';
import { guideUiFor } from '@/content/guide';
import type { Notice } from '@/components/app/NoticeBell';
import type { JumpEvent } from '@/components/app/QuickJump';
import type { Locale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

/**
 * The tab, the icon and the status bar follow the signed-in person's brand.
 *
 * The root layout brands these by host, which is right for a visitor. Inside
 * the app the person is known, and a producer who opened the console from the
 * platform's own address is still inside their own business: their icon in
 * the tab, their wash behind the clock. Nested metadata merges over the root's,
 * so only the fields that change are named here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandFor(await currentAccount());
  if (brand.isPlatform) return {};
  const icon = brand.iconUrl ?? '/icon-192.png';
  return {
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: 'black-translucent' },
    icons: { icon, apple: icon },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const brand = await brandFor(await currentAccount());
  return {
    themeColor: brand.isPlatform ? PAGE_GROUND : brand.accent.wash,
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

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

  /* The producer's live events, for the search box in the top bar. Three
     columns, no archive, scoped by row level security to their own. A couple
     gets none: their one event is the portal. */
  let events: JumpEvent[] = [];
  if (account.role !== 'client') {
    const { data: rows } = await sb
      .from('clients')
      .select('id,display_name,event_date')
      .is('archived_at', null)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(300);
    events = (rows ?? []).map((r) => ({ id: r.id, name: r.display_name, date: r.event_date }));
  }

  /* The couple's two menu labels, in the couple's language. Reused from the
     screens they name rather than written again: the portal's own title and
     the book's own title, so the menu and the page always agree. */
  let clientNav: ClientNavLabels | undefined;
  let locale: Locale = 'he';
  if (account.role === 'client') {
    locale = await currentLocale();
    clientNav = { portal: appUiFor(locale).portal.title, guide: guideUiFor(locale).pageTitle };
  }

  return (
    <AppShell account={account} notices={(data ?? []) as Notice[]} brand={brand} clientNav={clientNav} locale={locale} events={events}>
      {children}
      <Live sources={[{ table: 'notifications' }]} />
    </AppShell>
  );
}
