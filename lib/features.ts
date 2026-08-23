import 'server-only';

import { getSupabaseServerClient } from '@/lib/supabase/server';

export type FeatureKey =
  | 'moodboard' | 'rsvp' | 'seating' | 'bar' | 'receipts'
  | 'budget' | 'day_of' | 'bi' | 'white_label';

export type Tier = 'diy' | 'managed' | 'agency';

export interface FeatureFlag {
  key: FeatureKey;
  label_he: string;
  label_en: string;
  description_he: string | null;
  enabled_diy: boolean;
  enabled_managed: boolean;
  enabled_agency: boolean;
}

const COLUMN: Record<Tier, keyof FeatureFlag> = {
  diy: 'enabled_diy',
  managed: 'enabled_managed',
  agency: 'enabled_agency',
};

export async function loadFeatureFlags(): Promise<FeatureFlag[]> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from('feature_flags').select('*').order('key');
  return (data ?? []) as unknown as FeatureFlag[];
}

/** Which modules a given tier may use. */
export function allowedFeatures(flags: FeatureFlag[], tier: Tier): Set<FeatureKey> {
  const column = COLUMN[tier];
  return new Set(flags.filter((f) => Boolean(f[column])).map((f) => f.key));
}

export function isAllowed(flags: FeatureFlag[], tier: Tier, key: FeatureKey): boolean {
  const flag = flags.find((f) => f.key === key);
  return flag ? Boolean(flag[COLUMN[tier]]) : false;
}
