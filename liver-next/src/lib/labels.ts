import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LabelKind, ProducerLabel } from '@/app/actions/labels';

/** A producer's own taxonomy. Row level security scopes it to them, so there
 *  is nothing to filter here beyond the kind and the order they built it in. */
export async function loadLabels(sb: SupabaseClient, kind: LabelKind): Promise<ProducerLabel[]> {
  const { data, error } = await sb
    .from('producer_labels')
    .select('id,kind,label,color,sort_order')
    .eq('kind', kind)
    .order('sort_order');
  if (error) {
    /* A missing taxonomy costs a toolbar, never a screen. */
    console.error('[labels] read failed', error);
    return [];
  }
  return (data ?? []) as ProducerLabel[];
}
