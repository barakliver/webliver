import { notFound } from 'next/navigation';
import { getSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { loadFeatureFlags, type FeatureFlag } from '@/lib/features';
import AdminConsole from './AdminConsole';

export const dynamic = 'force-dynamic';

export interface PlatformStats {
  users_total: number;
  users_active_30d: number;
  producers_total: number;
  producers_pending: number;
  producers_approved: number;
  producers_suspended: number;
  tier_diy: number;
  tier_managed: number;
  tier_agency: number;
  workspaces_total: number;
  workspaces_unassigned: number;
}

export interface LeaderboardRow {
  producer_id: string;
  brand_name: string;
  status: 'pending' | 'approved' | 'suspended';
  tier: 'diy' | 'managed' | 'agency';
  workspace_count: number;
  activity_30d: number;
  created_at: string;
}

/**
 * Super Admin platform governance.
 *
 * Everything on this page comes from aggregate RPCs that are structurally
 * incapable of returning a couple, a guest, a budget line or a contract. The
 * admin role holds no RLS grant on any tenant data table, so even a hand-written
 * query from this session returns zero rows.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) notFound(); // middleware redirects first; this is defence in depth

  const supabase = await getSupabaseServerClient();

  // The single source of truth for "is this the root owner" lives in the
  // database, not in this file.
  const { data: isAdmin } = await supabase.rpc('is_platform_admin');
  if (!isAdmin) notFound();

  const [statsRes, boardRes, flags] = await Promise.all([
    supabase.rpc('admin_platform_stats'),
    supabase.rpc('admin_producer_leaderboard'),
    loadFeatureFlags(),
  ]);

  const stats = (statsRes.data ?? null) as PlatformStats | null;
  const leaderboard = (boardRes.data ?? []) as LeaderboardRow[];

  return (
    <AdminConsole
      email={user.email ?? ''}
      stats={stats}
      leaderboard={leaderboard}
      flags={flags as FeatureFlag[]}
    />
  );
}
