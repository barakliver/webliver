import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

/** Mirrors public.root_admin_email() in the database. Both must agree. */
export const ROOT_ADMIN_EMAIL = 'barakliver@gmail.com';

export type Role = 'super_admin' | 'producer' | 'client' | 'staff';
export type ProducerStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export type Account = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  producer: {
    id: string; brandName: string; status: ProducerStatus;
    /* Branding travels with the account rather than being fetched again by
       every screen that draws a header. */
    accent: string; logoUrl: string | null; tagline: string;
    whatsapp: string; slug: string | null; domain: string | null;
    iconUrl: string | null; coverUrl: string | null;
  } | null;
};

/**
 * The signed-in account, or null. Reads through row level security, so the
 * answer is the database's, not the browser's.
 *
 * Memoised for the length of one render, which is what `cache` from React
 * does and what the Next documentation prescribes for exactly this function.
 * It is not an optimisation looking for a problem: rendering one signed-in
 * screen called this four times before this line existed — generateMetadata
 * and generateViewport each resolve the brand from it, the app layout needs
 * the account, and then the page's own guard asks again — and each call is
 * three round trips to a database on the other side of a network, for the
 * session, the profile and the producer. Twelve where three will do, on
 * every screen, on a machine with a gigabyte of memory.
 *
 * The memo lives for one render pass and no longer. A server action is a
 * separate pass and asks again, so nothing here can serve a role or an
 * approval status that was changed a moment ago — which matters, because the
 * value being cached is the one every authorisation decision is made from.
 */
export const currentAccount = cache(async function currentAccount(): Promise<Account | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb
    .from('profiles')
    .select('id,email,full_name,role,avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  /* handle_new_user() writes the profile on signup, so a missing one means the
     account predates the schema. Defaulting that to 'client' was wrong twice
     over: it is the least likely case, and it fails silently — the root address
     was shown the couple's portal and looked like a working screen rather than
     a broken one. Fall back on the same rule the database uses, so the answer
     is at worst consistent with what the backfill will write. */
  const role = (profile?.role
    ?? (user.email?.toLowerCase() === ROOT_ADMIN_EMAIL ? 'super_admin' : 'producer')) as Role;

  const { data: producer } = await sb
    .from('producers')
    .select('id,brand_name,status,accent,logo_url,tagline,whatsapp,slug,domain,icon_url,cover_url')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? '',
    avatarUrl: profile?.avatar_url ?? null,
    role,
    producer: producer
      ? {
          id: producer.id,
          brandName: producer.brand_name,
          status: producer.status as ProducerStatus,
          accent: producer.accent ?? 'slate',
          logoUrl: producer.logo_url ?? null,
          tagline: producer.tagline ?? '',
          whatsapp: producer.whatsapp ?? '',
          slug: producer.slug ?? null,
          domain: producer.domain ?? null,
          iconUrl: producer.icon_url ?? null,
          coverUrl: producer.cover_url ?? null,
        }
      : null,
  };
})

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
