import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAccount, isLive } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { PageHead } from '@/components/app/PageHead';

export const metadata = { title: appCopy.nav.overview };

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card block transition-shadow hover:shadow-lift">
      <div className="text-[13px] font-semibold text-azure-600">{label}</div>
      <div className="mt-2 font-display text-[38px] font-semibold leading-none text-ink">{value}</div>
    </Link>
  );
}

export default async function OverviewPage() {
  const account = await requireAccount();
  if (account.role === 'client') redirect('/app/portal');
  if (!isLive(account)) redirect('/app/pending');

  const sb = await supabaseServer();
  const [leads, clients, tasks] = await Promise.all([
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('clients').select('id', { count: 'exact', head: true }),
    sb.from('tasks').select('id', { count: 'exact', head: true }).eq('done', false),
  ]);

  return (
    <>
      <PageHead title={`${appCopy.overview.greeting}${account.fullName ? ' ' + account.fullName : ''}`} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label={appCopy.overview.leadsTitle}   value={leads.count ?? 0}   href="/app/leads" />
        <Stat label={appCopy.overview.clientsTitle} value={clients.count ?? 0} href="/app/clients" />
        <Stat label={appCopy.overview.tasksTitle}   value={tasks.count ?? 0}   href="/app/clients" />
      </div>
    </>
  );
}
