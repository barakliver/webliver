import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

/* ── What the platform owner may know ──────────────────────────────────────
   This file used to select from clients and client_authorized_emails and hand
   the console every couple on the platform by name, because the policies let
   root read them. They no longer do.

   So nothing here reads a workspace. Two functions run as the definer, count
   what they were asked to count, and return numbers plus the one identity that
   governance actually needs: the producer's own. No couple, no event name, no
   money and no guest crosses this file.

   The cost is real and worth stating: there is no longer a screen on which
   root can look at somebody else's event to work out why it is behaving
   oddly. Support is a screen share now.                                    */

export type Stats = {
  usersTotal: number;
  usersActive30d: number;
  usersNeverSeen: number;
  producersTotal: number;
  producersApproved: number;
  producersPending: number;
  producersBlocked: number;
  couplesTotal: number;
  couplesManaged: number;
  couplesDiy: number;
  eventsTotal: number;
  eventsLive: number;
  leadsTotal: number;
  leads30d: number;
};

export type ProducerRow = {
  id: string;
  brand: string;
  email: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  lastSeen: string | null;
  eventsLive: number;
  eventsTotal: number;
  leadsTotal: number;
  leads30d: number;
  signedTotal: number;
  isRoot: boolean;
};

export type Flag = { key: string; label: string; diy: boolean; managed: boolean };

export type Console = { stats: Stats | null; producers: ProducerRow[]; flags: Flag[] };

const ZERO: Stats = {
  usersTotal: 0, usersActive30d: 0, usersNeverSeen: 0,
  producersTotal: 0, producersApproved: 0, producersPending: 0, producersBlocked: 0,
  couplesTotal: 0, couplesManaged: 0, couplesDiy: 0,
  eventsTotal: 0, eventsLive: 0, leadsTotal: 0, leads30d: 0,
};

export async function getConsole(rootEmail: string): Promise<Console> {
  const sb = await supabaseServer();

  const [statsQ, boardQ, flagsQ] = await Promise.all([
    sb.rpc('platform_stats'),
    sb.rpc('producer_leaderboard'),
    sb.from('feature_flags').select('key,label,diy,managed').order('key'),
  ]);

  if (statsQ.error) console.error('[console] stats failed', statsQ.error);
  if (boardQ.error) console.error('[console] leaderboard failed', boardQ.error);

  /* The function returns a single row. A failed call leaves the band showing
     zeroes with an explanation rather than crashing the console the one time
     somebody needs it. */
  const raw = Array.isArray(statsQ.data) ? statsQ.data[0] : statsQ.data;
  const stats: Stats | null = raw
    ? {
        usersTotal: raw.users_total ?? 0,
        usersActive30d: raw.users_active_30d ?? 0,
        usersNeverSeen: raw.users_never_seen ?? 0,
        producersTotal: raw.producers_total ?? 0,
        producersApproved: raw.producers_approved ?? 0,
        producersPending: raw.producers_pending ?? 0,
        producersBlocked: raw.producers_blocked ?? 0,
        couplesTotal: raw.couples_total ?? 0,
        couplesManaged: raw.couples_managed ?? 0,
        couplesDiy: raw.couples_diy ?? 0,
        eventsTotal: raw.events_total ?? 0,
        eventsLive: raw.events_live ?? 0,
        leadsTotal: raw.leads_total ?? 0,
        leads30d: raw.leads_30d ?? 0,
      }
    : statsQ.error ? null : ZERO;

  const producers: ProducerRow[] = (boardQ.data ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.producer_id),
    brand: String(p.brand ?? ''),
    email: String(p.contact_email ?? ''),
    status: (p.status ?? 'pending') as ProducerRow['status'],
    lastSeen: (p.last_seen_at as string | null) ?? null,
    eventsLive: Number(p.events_live ?? 0),
    eventsTotal: Number(p.events_total ?? 0),
    leadsTotal: Number(p.leads_total ?? 0),
    leads30d: Number(p.leads_30d ?? 0),
    signedTotal: Number(p.signed_total ?? 0),
    /* The root account is not something to approve, suspend or reject. It is
       the thing doing the approving, and offering those buttons against it is
       an invitation to lock yourself out of your own platform. */
    isRoot: String(p.contact_email ?? '').toLowerCase() === rootEmail.toLowerCase(),
  }));

  return { stats, producers, flags: (flagsQ.data ?? []) as Flag[] };
}
