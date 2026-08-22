import { notFound } from 'next/navigation';
import { getSupabaseAnonClient } from '@/lib/supabase/server';
import type { RsvpPayload } from '@/lib/supabase/database.types';
import RsvpGuestForm from './RsvpGuestForm';

export const dynamic = 'force-dynamic';

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Anonymous: the SECURITY DEFINER RPC is the only thing this role can reach.
  const supabase = getSupabaseAnonClient();
  const { data, error } = await supabase.rpc('rsvp_get', { p_token: token });

  if (error || !data) notFound();
  return <RsvpGuestForm token={token} payload={data as RsvpPayload} />;
}
