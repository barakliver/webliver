import { requireAccount } from '@/lib/auth';
import { AppShell } from '@/components/app/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  return <AppShell account={account}>{children}</AppShell>;
}
