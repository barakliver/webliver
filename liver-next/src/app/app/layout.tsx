import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Live } from '@/components/app/Live';
import { AppShell } from '@/components/app/AppShell';
import type { Notice } from '@/components/app/NoticeBell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();

  /* the policy already limits this to the signed-in person's own inbox, so
     there is nothing to filter here beyond keeping the list short */
  const sb = await supabaseServer();
  const { data } = await sb
    .from('notifications')
    .select('id,kind,title,body,href,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <AppShell account={account} notices={(data ?? []) as Notice[]}>
      {children}
      <Live sources={[{ table: 'notifications' }]} />
    </AppShell>
  );
}
