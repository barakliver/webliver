import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows } from '@/lib/safe';
import type { Envelope } from '@/components/app/EnvelopesPanel';

/** The envelopes for one or more workspaces, in the couple's order.
 *
 *  Read in one query for every id rather than one per event, the way every
 *  other list on the portal is read: the page already holds the ids, and a
 *  summary strip that costs a round trip per row is a strip somebody removes
 *  the first time the screen feels slow. */
export async function loadEnvelopes(
  sb: SupabaseClient<any, any, any>,
  clientIds: string[],
): Promise<Map<string, Envelope[]>> {
  const byClient = new Map<string, Envelope[]>();
  if (clientIds.length === 0) return byClient;
  clientIds.forEach((id) => byClient.set(id, []));

  const rows = await safeRows<Envelope & { client_id: string }>('envelopes', sb.from('event_envelopes')
    .select('id,client_id,label,amount,recipient,cash,delivered_at,note')
    .in('client_id', clientIds).order('sort').order('created_at'));

  for (const r of rows) {
    byClient.get(r.client_id)?.push({
      id: r.id, label: r.label, amount: r.amount === null ? null : Number(r.amount),
      recipient: r.recipient, cash: r.cash, delivered_at: r.delivered_at, note: r.note,
    });
  }
  return byClient;
}

export const envelopesOf = (all: Map<string, Envelope[]>, id: string): Envelope[] => all.get(id) ?? [];
