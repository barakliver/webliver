import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LedgerEntry } from '@/components/app/LedgerEntries';

/** The producer's own entries: all of them, newest first, or one event's. */
export async function loadLedger(sb: SupabaseClient, opts: { clientId?: string; limit?: number } = {}): Promise<LedgerEntry[]> {
  let q = sb.from('producer_ledger')
    .select('id,client_id,kind,amount,label,party,note,on_date,clients(display_name)')
    .order('on_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.clientId) q = q.eq('client_id', opts.clientId);
  const { data, error } = await q;
  if (error) {
    console.error('[ledger] could not read', { message: error.message });
    return [];
  }
  return (data ?? []).map((r) => {
    const rel = (r as { clients?: { display_name?: string } | { display_name?: string }[] | null }).clients;
    const name = Array.isArray(rel) ? rel[0]?.display_name : rel?.display_name;
    return {
      id: String(r.id),
      client_id: (r.client_id as string | null) ?? null,
      kind: r.kind === 'expense' ? 'expense' : 'income',
      amount: Number(r.amount) || 0,
      label: String(r.label ?? ''),
      party: String(r.party ?? ''),
      note: String(r.note ?? ''),
      on_date: String(r.on_date ?? ''),
      event_name: name ? String(name) : null,
    };
  });
}
