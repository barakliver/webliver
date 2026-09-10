'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';
import { allocate, PLAN_CATEGORIES, type BudgetPlan, type PlanCategory } from '@/lib/budgetPlan';

export type PlanResult = { ok: boolean; error?: string; plan?: BudgetPlan };

const pick = (v: unknown): PlanCategory[] =>
  Array.isArray(v)
    ? v.map(String).filter((k): k is PlanCategory => (PLAN_CATEGORIES as readonly string[]).includes(k)).slice(0, 5)
    : [];

/**
 * The plan, written down.
 *
 * Built again here from the same inputs rather than trusted from the
 * screen, so the split that lands is the one the tested module produces.
 * The total also becomes the event's target budget, so the five figures on
 * the money screen and this plan cannot name two different ceilings.
 */
export async function saveBudgetPlan(clientId: string, raw: unknown): Promise<PlanResult> {
  await requireLiveProducer();
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const total = Math.round(Number(o.total));
  if (!Number.isFinite(total) || total < 1000) return { ok: false, error: 'סך התקציב צריך להיות מספר, לפחות אלף' };
  const g = Number(o.guests);
  const guests = Number.isFinite(g) && g > 0 ? Math.min(5000, Math.round(g)) : null;
  const must = pick(o.must);
  const nice = pick(o.nice).filter((k) => !must.includes(k));

  const { lines } = allocate({ total, guests, must, nice });
  const plan: BudgetPlan = {
    total, guests, must, nice,
    splits: Object.fromEntries(lines.map((l) => [l.key, l.pct])) as Record<PlanCategory, number>,
  };

  const sb = await supabaseServer();
  const { error } = await sb.from('clients')
    .update({ budget_plan: plan, budget_target: total })
    .eq('id', clientId);
  if (error) {
    console.error('[budget] plan not saved', { message: error.message });
    return { ok: false, error: 'לא הצלחנו לשמור את התוכנית' };
  }

  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  return { ok: true, plan };
}
