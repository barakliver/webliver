import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type Role = 'super_admin' | 'producer' | 'client' | 'staff';
export type ProducerStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export type Account = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  producer: { id: string; brandName: string; status: ProducerStatus } | null;
  /** workspaces this account may open: owned ones for a producer, invited ones
   *  for a couple. The root admin sees every workspace. */
  clientIds: string[];
};

/** The signed-in account, or null. Reads through row level security, so the
 *  answer is the database's, not the browser's. */
export async function currentAccount(): Promise<Account | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', user.id)
    .maybeSingle();

  /* the profile trigger runs on signup; if it has not landed yet, fall back to
     the auth record rather than rendering a broken shell */
  const role = (profile?.role ?? 'client') as Role;

  const { data: producer } = await sb
    .from('producers')
    .select('id,brand_name,status')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  const { data: clients } = await sb.from('clients').select('id');

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? '',
    role,
    producer: producer
      ? { id: producer.id, brandName: producer.brand_name, status: producer.status as ProducerStatus }
      : null,
    clientIds: (clients ?? []).map((c) => c.id),
  };
}

export async function requireAccount(): Promise<Account> {
  const a = await currentAccount();
  if (!a) redirect('/login');
  return a;
}

/** A producer may only work once the root admin has approved them. */
export function isLive(a: Account): boolean {
  return a.role === 'super_admin' || a.role === 'client' || a.producer?.status === 'approved';
}

export async function requireLiveProducer(): Promise<Account> {
  const a = await requireAccount();
  if (a.role === 'client') redirect('/app/portal');
  if (!isLive(a)) redirect('/app/pending');
  return a;
}

export async function requireRoot(): Promise<Account> {
  const a = await requireAccount();
  if (a.role !== 'super_admin') redirect('/app');
  return a;
}
